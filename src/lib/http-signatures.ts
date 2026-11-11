import crypto from 'node:crypto';
import { kv } from '@vercel/kv';
import { NEW_ACTOR } from './ap-identity';

function normalizePem(raw: string): string {
  const pem = raw
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = pem.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const header = lines[0] ?? '';
  if (!header.startsWith('-----BEGIN ')) {
    throw new Error(`Key does not look like PEM — starts with: "${header.slice(0, 40)}"`);
  }
  if (header.includes('PUBLIC KEY')) {
    throw new Error(`Got a PUBLIC key where a PRIVATE key is required (${header})`);
  }
  return lines.join('\n') + '\n';
}

function parseSignatureHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, '$1');
    result[key] = val;
  }
  return result;
}

// Builds a draft-cavage `Signature` header value over the given
// (name, value) pairs, in order.
function buildSignatureHeader(keyId: string, privateKeyPem: string, pairs: [string, string][]): string {
  const signingString = pairs.map(([name, value]) => `${name}: ${value}`).join('\n');
  const privateKey = crypto.createPrivateKey(normalizePem(privateKeyPem));
  const sig = crypto.sign('sha256', Buffer.from(signingString, 'utf8'), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  }).toString('base64');
  return (
    `keyId="${keyId}",algorithm="rsa-sha256",` +
    `headers="${pairs.map(([name]) => name).join(' ')}",signature="${sig}"`
  );
}

// GETs an ActivityPub document, signed as the new actor. Instances running
// in "authorized fetch" (secure) mode refuse unsigned fetches of actors and
// posts, which would otherwise stop their users following us at all: we
// couldn't read their public key or their inbox. Falls back to an unsigned
// request if our key isn't configured or won't sign.
export async function fetchActivityJson(url: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/activity+json, application/ld+json',
  };
  const privateKeyPem = process.env[NEW_ACTOR.privateKeyEnvVar];
  if (privateKeyPem) {
    try {
      const target = new URL(url);
      const date = new Date().toUTCString();
      headers.Signature = buildSignatureHeader(NEW_ACTOR.keyId, privateKeyPem, [
        ['(request-target)', `get ${target.pathname}${target.search}`],
        ['host', target.host],
        ['date', date],
      ]);
      headers.Host = target.host;
      headers.Date = date;
    } catch (err) {
      console.error('Could not sign outbound GET, sending unsigned:', (err as Error).message);
    }
  }
  return fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
}

export interface SignerKey {
  pem: string;
  /** The actor the key belongs to: what an activity's `actor` must match. */
  owner: string;
}

// Pulls the public key and its owning actor out of whatever document lives
// at a keyId URL. Usually that's the actor itself (Mastodon:
// `<actor>#main-key`), but some servers give the key its own URL
// (GoToSocial: `<actor>/main-key`) and serve either a stub actor or a bare
// key object there. So the owner comes from the document, not from
// trimming the keyId. The owner must be on the keyId's own host, since a
// server can only vouch for its own actors. Exported for unit testing.
export function extractSignerKey(doc: unknown, keyId: string): SignerKey {
  if (!doc || typeof doc !== 'object') throw new Error(`No key document at ${keyId}`);
  const d = doc as Record<string, unknown>;

  const candidates = (Array.isArray(d.publicKey) ? d.publicKey : [d.publicKey]).filter(
    (k): k is Record<string, unknown> => !!k && typeof k === 'object',
  );
  const key = candidates.find((k) => k.id === keyId) ?? candidates[0];

  const pem = key ? key.publicKeyPem : d.publicKeyPem;
  const owner = key ? (key.owner ?? d.id) : d.owner;

  if (typeof pem !== 'string' || !pem) throw new Error(`No publicKeyPem found for ${keyId}`);
  if (typeof owner !== 'string' || !owner.startsWith('https://')) {
    throw new Error(`No key owner found for ${keyId}`);
  }
  if (new URL(owner).host !== new URL(keyId).host) {
    throw new Error(`Key owner ${owner} is on a different host than ${keyId}`);
  }
  return { pem, owner };
}

// Negative cache for key URLs that recently failed to resolve (gone, timed
// out, or malformed). Short TTL rather than permanent: a failure could be
// transient, and an actor that's since recovered shouldn't stay blocked.
const FAILED_ACTOR_TTL_SECONDS = 60 * 60;

// Verified keys are cached so an inbound activity doesn't cost an outbound
// fetch every time. A key that stops verifying is re-fetched once (see
// verifySignature), which covers key rotation.
const SIGNER_KEY_TTL_SECONDS = 60 * 60 * 24;

async function getSignerKey(
  keyId: string,
  opts: { fresh?: boolean } = {},
): Promise<SignerKey & { cached: boolean }> {
  const keyCacheKey = `cybw:ap:key:${keyId}`;
  if (!opts.fresh) {
    const cached = await kv.get<SignerKey>(keyCacheKey);
    if (cached?.pem && cached.owner) return { ...cached, cached: true };
  }

  const keyUrl = keyId.includes('#') ? keyId.slice(0, keyId.indexOf('#')) : keyId;
  const badKey = `cybw:ap:bad-actor:${keyUrl}`;
  if (await kv.get(badKey)) {
    throw new Error(`Actor recently failed to resolve (cached): ${keyUrl}`);
  }

  try {
    const res = await fetchActivityJson(keyUrl);
    if (!res.ok) throw new Error(`Failed to fetch actor at ${keyUrl}: ${res.status}`);
    const signerKey = extractSignerKey(await res.json(), keyId);
    await kv.set(keyCacheKey, signerKey, { ex: SIGNER_KEY_TTL_SECONDS });
    return { ...signerKey, cached: false };
  } catch (err) {
    await kv.set(badKey, 1, { ex: FAILED_ACTOR_TTL_SECONDS });
    throw err;
  }
}

// Signed Date headers older/newer than this are rejected to limit replay of
// captured requests. Mastodon uses the same 1-hour window.
const MAX_CLOCK_SKEW_MS = 60 * 60 * 1000;

// These must all be covered by the signature — otherwise the sender chooses
// what's protected, and an unsigned digest/date would let an attacker swap
// the body or replay old requests behind a valid signature.
const REQUIRED_SIGNED_HEADERS = ['(request-target)', 'host', 'date', 'digest'];

// Verifies an inbound HTTP signature (either scheme: the draft-cavage
// `Signature` header nearly everything sends today, or RFC 9421's
// `Signature-Input` pair) and that the signed digest matches
// `rawBody`, and returns the verified signer's actor URL (the owner of the
// signing key) — callers must check it against whatever actor the payload
// claims to be from, since the body itself is attacker-supplied.
export async function verifySignature(
  method: string,
  pathname: string,
  headers: Record<string, string>,
  rawBody: string,
): Promise<string> {
  if (headers['signature-input']) return verifyMessageSignature(method, pathname, headers, rawBody);

  const sigHeader = headers['signature'];
  if (!sigHeader) throw new Error('Missing Signature header');

  const { keyId, headers: signedHeaderNames, signature } = parseSignatureHeader(sigHeader);
  if (!keyId || !signedHeaderNames || !signature) throw new Error('Malformed Signature header');
  if (!keyId.startsWith('https://')) throw new Error(`keyId must be an https URL: ${keyId}`);

  const signedNames = signedHeaderNames.toLowerCase().split(' ');
  for (const required of REQUIRED_SIGNED_HEADERS) {
    if (!signedNames.includes(required)) throw new Error(`Signature must cover ${required}`);
  }

  const dateHeader = headers['date'];
  if (!dateHeader) throw new Error('Missing Date header');
  const requestTime = Date.parse(dateHeader);
  if (Number.isNaN(requestTime) || Math.abs(Date.now() - requestTime) > MAX_CLOCK_SKEW_MS) {
    throw new Error(`Date header outside acceptance window: ${dateHeader}`);
  }

  // Digest format: "SHA-256=<base64>" — the base64 value itself contains '='
  // padding, so split only on the first one.
  const expectedDigest = crypto.createHash('sha256').update(rawBody, 'utf8').digest('base64');
  const digestHeader = headers['digest'] ?? '';
  const eqIdx = digestHeader.indexOf('=');
  const digestAlgo = eqIdx === -1 ? '' : digestHeader.slice(0, eqIdx);
  const digestValue = eqIdx === -1 ? '' : digestHeader.slice(eqIdx + 1);
  if (digestAlgo.toLowerCase() !== 'sha-256' || digestValue !== expectedDigest) {
    throw new Error('Digest header does not match request body');
  }

  const signingString = signedNames.map(name => {
    if (name === '(request-target)') return `(request-target): ${method.toLowerCase()} ${pathname}`;
    const val = headers[name];
    if (val === undefined) throw new Error(`Signed header absent from request: ${name}`);
    return `${name}: ${val}`;
  }).join('\n');

  return ownerOfValidSignature(keyId, Buffer.from(signingString, 'utf8'), Buffer.from(signature, 'base64'));
}

// Checks `signature` over `data` against the key at `keyId` and returns the
// key's owner. RSA keys use RSASSA-PKCS1-v1_5 with SHA-256 (what the
// fediverse signs with); Ed25519 keys are accepted too.
async function ownerOfValidSignature(keyId: string, data: Buffer, signature: Buffer): Promise<string> {
  const verifies = (pem: string): boolean => {
    try {
      const key = crypto.createPublicKey(pem);
      return key.asymmetricKeyType === 'ed25519'
        ? crypto.verify(null, data, key, signature)
        : crypto.verify('sha256', data, { key, padding: crypto.constants.RSA_PKCS1_PADDING }, signature);
    } catch {
      return false;
    }
  };

  let key = await getSignerKey(keyId);
  let isValid = verifies(key.pem);
  if (!isValid && key.cached) {
    // The cached key may have been rotated — try once more with a fresh copy.
    key = await getSignerKey(keyId, { fresh: true });
    isValid = verifies(key.pem);
  }
  if (!isValid) throw new Error('Signature verification failed');

  return key.owner;
}

export interface MessageSignature {
  /** Covered components, in signing order, e.g. `@method`, `content-digest`. */
  components: string[];
  /** The signature parameters exactly as sent: they are signed verbatim. */
  params: string;
  keyId: string;
  created: number;
  expires?: number;
  alg?: string;
  signature: Buffer;
}

const SF_TOKEN = '[A-Za-z0-9_*.-]+';

// Parses RFC 9421's `Signature-Input` / `Signature` header pair, e.g.
//   Signature-Input: sig1=("@method" "@target-uri" "content-digest");created=1748341414;keyid="https://…#main-key"
//   Signature: sig1=:BASE64:
// Only a single signature is supported, the same limit Mastodon applies.
// Exported for unit testing.
export function parseMessageSignature(signatureInput: string, signatureHeader: string): MessageSignature {
  const match = signatureInput.match(
    new RegExp(`^\\s*(${SF_TOKEN})=(\\(([^)]*)\\)((?:;${SF_TOKEN}(?:=(?:"[^"]*"|[^;,\\s]+))?)*))\\s*$`),
  );
  if (!match) throw new Error('Malformed Signature-Input header');
  const [, label, params, list, paramList] = match;

  const components = list.trim().split(/\s+/).filter(Boolean).map((item) => {
    const name = item.match(/^"([^"]+)"$/)?.[1];
    if (!name) throw new Error(`Unsupported signature component: ${item}`);
    return name.toLowerCase();
  });

  const values: Record<string, string> = {};
  for (const [, name, raw] of paramList.matchAll(new RegExp(`;(${SF_TOKEN})(?:=("[^"]*"|[^;,\\s]+))?`, 'g'))) {
    values[name] = (raw ?? '').replace(/^"(.*)"$/, '$1');
  }

  const sig = signatureHeader.match(
    new RegExp(`(?:^|,)\\s*${label.replace(/[.*]/g, '\\$&')}=:([A-Za-z0-9+/=]+):`),
  )?.[1];
  if (!sig) throw new Error('Malformed Signature header');

  const created = Number(values.created);
  if (!values.keyid || !Number.isFinite(created) || !values.created) {
    throw new Error('Signature-Input must include keyid and created');
  }

  return {
    components,
    params,
    keyId: values.keyid,
    created,
    ...(values.expires ? { expires: Number(values.expires) } : {}),
    ...(values.alg ? { alg: values.alg } : {}),
    signature: Buffer.from(sig, 'base64'),
  };
}

// The same protection the older scheme's required headers give: method and
// full URL (so a signature can't be replayed at another endpoint or host)
// and the body digest. Mastodon requires the same three.
const REQUIRED_COMPONENTS = ['@method', '@target-uri', 'content-digest'];
const SUPPORTED_ALGS = ['rsa-v1_5-sha256', 'ed25519'];

// RFC 9421 HTTP Message Signatures, the standard replacing the draft
// scheme above. Mastodon already retries with it when the draft signature
// is refused, and newer software may send nothing else.
async function verifyMessageSignature(
  method: string,
  pathname: string,
  headers: Record<string, string>,
  rawBody: string,
): Promise<string> {
  const sig = parseMessageSignature(headers['signature-input'], headers['signature'] ?? '');
  if (!sig.keyId.startsWith('https://')) throw new Error(`keyid must be an https URL: ${sig.keyId}`);
  if (sig.alg && !SUPPORTED_ALGS.includes(sig.alg)) throw new Error(`Unsupported signature algorithm: ${sig.alg}`);
  for (const required of REQUIRED_COMPONENTS) {
    if (!sig.components.includes(required)) throw new Error(`Signature must cover ${required}`);
  }

  const now = Date.now();
  if (Math.abs(now - sig.created * 1000) > MAX_CLOCK_SKEW_MS) {
    throw new Error(`Signature created outside acceptance window: ${sig.created}`);
  }
  if (sig.expires !== undefined && !(sig.expires * 1000 > now)) throw new Error('Signature has expired');

  // Content-Digest (RFC 9530): `sha-256=:<base64>:`, possibly alongside
  // other algorithms.
  const contentDigest = headers['content-digest'] ?? '';
  const digestMatch = contentDigest.match(/(?:^|,)\s*(sha-256|sha-512)=:([A-Za-z0-9+/=]+):/i);
  const expectedDigest =
    digestMatch &&
    crypto
      .createHash(digestMatch[1].toLowerCase() === 'sha-512' ? 'sha512' : 'sha256')
      .update(rawBody, 'utf8')
      .digest('base64');
  if (!digestMatch || digestMatch[2] !== expectedDigest) {
    throw new Error('Content-Digest header does not match request body');
  }

  const host = headers['host'];
  if (!host) throw new Error('Missing Host header');
  const derived: Record<string, string> = {
    '@method': method.toUpperCase(),
    '@target-uri': `https://${host}${pathname}`,
    '@authority': host.toLowerCase(),
    '@scheme': 'https',
    '@path': pathname,
  };

  const lines = sig.components.map((name) => {
    const value = name.startsWith('@') ? derived[name] : headers[name]?.trim();
    if (value === undefined) throw new Error(`Signed component absent from request: ${name}`);
    return `"${name}": ${value}`;
  });
  lines.push(`"@signature-params": ${sig.params}`);

  return ownerOfValidSignature(sig.keyId, Buffer.from(lines.join('\n'), 'utf8'), sig.signature);
}

export async function signAndDeliver(
  inboxUrl: string,
  activity: object,
  keyId: string,
  privateKeyPem: string,
): Promise<number> {
  const body = JSON.stringify(activity);
  const digest = `SHA-256=${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}`;
  const date = new Date().toUTCString();
  const url = new URL(inboxUrl);

  const signatureHeader = buildSignatureHeader(keyId, privateKeyPem, [
    ['(request-target)', `post ${url.pathname}${url.search}`],
    ['host', url.host],
    ['date', date],
    ['digest', digest],
  ]);

  const res = await fetch(inboxUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/activity+json',
      Host: url.host,
      Date: date,
      Digest: digest,
      Signature: signatureHeader,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  return res.status;
}

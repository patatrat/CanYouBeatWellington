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

// Verifies an inbound HTTP signature and that the signed digest matches
// `rawBody`, and returns the verified signer's actor URL (the owner of the
// signing key) — callers must check it against whatever actor the payload
// claims to be from, since the body itself is attacker-supplied.
export async function verifySignature(
  method: string,
  pathname: string,
  headers: Record<string, string>,
  rawBody: string,
): Promise<string> {
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

  const verifies = (pem: string): boolean => {
    try {
      return crypto.verify(
        'sha256',
        Buffer.from(signingString, 'utf8'),
        { key: crypto.createPublicKey(pem), padding: crypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(signature, 'base64'),
      );
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

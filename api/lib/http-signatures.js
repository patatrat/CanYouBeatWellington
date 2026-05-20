import crypto from 'node:crypto';

/**
 * Normalise a PEM string coming from an environment variable.
 * Handles: literal \n escapes, CRLF line endings, stray whitespace per line.
 */
function normalizePem(raw) {
  const pem = raw
    .replace(/\\n/g, '\n')   // literal \n escape sequences → newline
    .replace(/\r\n/g, '\n')  // CRLF → LF
    .replace(/\r/g, '\n');   // bare CR → LF

  const lines = pem.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Sanity-check: must be a private key PEM, not a public key or something else
  const header = lines[0] ?? '';
  if (!header.startsWith('-----BEGIN ')) {
    throw new Error(`Key does not look like PEM — starts with: "${header.slice(0, 40)}"`);
  }
  if (header.includes('PUBLIC KEY')) {
    throw new Error(`Got a PUBLIC key where a PRIVATE key is required (${header})`);
  }

  return lines.join('\n') + '\n';
}

function parseSignatureHeader(header) {
  const result = {};
  for (const part of header.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, '$1');
    result[key] = val;
  }
  return result;
}

async function fetchActorPublicKey(keyId) {
  const actorUrl = keyId.includes('#') ? keyId.slice(0, keyId.indexOf('#')) : keyId;
  const res = await fetch(actorUrl, {
    headers: { Accept: 'application/activity+json, application/ld+json' },
  });
  if (!res.ok) throw new Error(`Failed to fetch actor at ${actorUrl}: ${res.status}`);
  const actor = await res.json();
  const pem = actor?.publicKey?.publicKeyPem;
  if (!pem) throw new Error(`No publicKeyPem found at ${actorUrl}`);
  return pem;
}

/**
 * Verify an HTTP Signature on an incoming ActivityPub request.
 * @param {string} method - HTTP method (e.g. 'POST')
 * @param {string} pathname - Canonical request path (e.g. '/actor/inbox')
 * @param {Record<string,string>} headers - Request headers (Node.js lowercases these)
 */
export async function verifySignature(method, pathname, headers) {
  const sigHeader = headers['signature'];
  if (!sigHeader) throw new Error('Missing Signature header');

  const { keyId, headers: signedHeaderNames, signature } = parseSignatureHeader(sigHeader);
  if (!keyId || !signedHeaderNames || !signature) throw new Error('Malformed Signature header');

  const signingString = signedHeaderNames.split(' ').map(name => {
    if (name === '(request-target)') return `(request-target): ${method.toLowerCase()} ${pathname}`;
    const val = headers[name];
    if (val === undefined) throw new Error(`Signed header absent from request: ${name}`);
    return `${name}: ${val}`;
  }).join('\n');

  const publicKeyPem = await fetchActorPublicKey(keyId);
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const isValid = crypto.verify(
    'sha256',
    Buffer.from(signingString, 'utf8'),
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(signature, 'base64'),
  );

  if (!isValid) throw new Error('Signature verification failed');
}

/**
 * Sign an ActivityPub activity with our private key and POST it to a remote inbox.
 * @param {string} inboxUrl - Recipient inbox URL
 * @param {object} activity - ActivityPub activity object
 * @param {string} keyId - Key ID URL (e.g. 'https://domain.com/actor#main-key')
 * @param {string} privateKeyPem - RSA-2048 private key in PEM format
 * @returns {Promise<number>} HTTP response status from the remote server
 */
export async function signAndDeliver(inboxUrl, activity, keyId, privateKeyPem) {
  const body = JSON.stringify(activity);
  const digest = `SHA-256=${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}`;
  const date = new Date().toUTCString();
  const url = new URL(inboxUrl);

  const signingString = [
    `(request-target): post ${url.pathname}`,
    `host: ${url.host}`,
    `date: ${date}`,
    `digest: ${digest}`,
  ].join('\n');

  const privateKey = crypto.createPrivateKey(normalizePem(privateKeyPem));
  const sig = crypto.sign('sha256', Buffer.from(signingString, 'utf8'), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  }).toString('base64');

  const signatureHeader =
    `keyId="${keyId}",algorithm="rsa-sha256",` +
    `headers="(request-target) host date digest",signature="${sig}"`;

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
  });

  return res.status;
}

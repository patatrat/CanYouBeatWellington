/**
 * Generate a fresh RSA-2048 key pair for the ActivityPub actor.
 * Outputs values formatted for direct paste into Vercel environment variables.
 *
 * Run with:
 *   node scripts/gen-ap-keys.js
 *
 * DELETE this output from your terminal history after pasting into Vercel.
 */

import crypto from 'node:crypto';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Collapse to a single line with literal \n — the format Vercel env vars expect.
const forVercel = pem => pem.trim().replace(/\n/g, '\\n');

console.log('\n=== AP_PRIVATE_KEY (paste this into Vercel) ===');
console.log(forVercel(privateKey));
console.log('\n=== AP_PUBLIC_KEY (paste this into Vercel) ===');
console.log(forVercel(publicKey));
console.log('\nDone. Update both values in Vercel → Settings → Environment Variables, then redeploy.');

import { sha3_256 } from '@totemsdk/core';
import { wotsSign, wotsVerify, derivePKdigest, deriveFullPublicKey, wotsVerifyDigest } from '../src/wots.js';
import { getParamSet } from '../src/params.js';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const ps = getParamSet();

const TEST_SEED = new Uint8Array([
  0x51, 0xD9, 0xF4, 0x03, 0x27, 0x1E, 0x26, 0x72,
  0x29, 0xB6, 0xC2, 0xA9, 0x5C, 0x5E, 0xAE, 0xD5,
  0x27, 0x84, 0x6A, 0x1A, 0xF8, 0x9F, 0x8B, 0x1C,
  0xF5, 0x57, 0x4B, 0x0E, 0x79, 0xA4, 0x9C, 0xF1
]);

const messages = [
  'Hello, Totem!',
  '{"domain":"example.com","nonce":"abc123","issuedAt":1700000000000}'
];

const vectors: any[] = [];

for (let i = 0; i < messages.length; i++) {
  const message = messages[i];
  const digest = sha3_256(new TextEncoder().encode(message));

  console.error(`Generating WOTS keypair for index ${i}...`);
  const pkDigest = derivePKdigest(TEST_SEED, i, ps);
  const pkFull = deriveFullPublicKey(TEST_SEED, i, ps);
  
  console.error(`Signing message ${i}...`);
  const sig = wotsSign(TEST_SEED, i, digest, ps);
  
  const ok = wotsVerify(sig, digest, pkFull, ps);
  if (!ok) throw new Error(`Self-verify with full PK failed for message ${i}`);
  
  const ok2 = wotsVerifyDigest(sig, digest, pkDigest, ps);
  if (!ok2) throw new Error(`Self-verify with PK digest failed for message ${i}`);
  
  console.error(`WOTS vector ${i}: verified OK (sig ${sig.length} bytes)`);
  
  vectors.push({
    description: i === 0 ? 'Simple message - WOTS signature verification' : 'JSON challenge - WOTS signature verification',
    message,
    publicKeyFullHex: toHex(pkFull),
    publicKeyDigestHex: toHex(pkDigest),
    signatureHex: toHex(sig),
    digestHex: toHex(digest),
    keyIndex: i,
    shouldVerify: true
  });
}

vectors.push({
  description: 'Wrong public key - verification should fail',
  message: 'Hello, Totem!',
  publicKeyFullHex: 'aa'.repeat(vectors[0].publicKeyFullHex.length / 2),
  publicKeyDigestHex: 'bb'.repeat(32),
  signatureHex: vectors[0].signatureHex,
  digestHex: vectors[0].digestHex,
  keyIndex: 0,
  shouldVerify: false,
  expectedError: 'Public key does not match signature'
});

const output = {
  _comment: 'Totem SDK WOTS Test Vectors. Use to verify your WOTS signature pipeline is working correctly.',
  _usage: 'For each vector with shouldVerify=true: sha3_256(message) should equal digestHex, and wotsVerify(signatureHex, digestHex, publicKeyFullHex) should return true.',
  sdkVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  hexConvention: 'All hex values are lowercase without 0x prefix',
  wotsParams: { w: ps.w, n: ps.n, totalChains: ps.L, messageChains: ps.chains, checksumChains: ps.checksumChains },
  vectors
};

console.log(JSON.stringify(output, null, 2));

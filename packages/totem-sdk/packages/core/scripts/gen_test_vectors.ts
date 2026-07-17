import { sha3_256 } from '@totemsdk/core';
import { TreeKey, serializeTreeSignature, verifyTreeSignature, deserializeTreeSignature, DEFAULT_KEYS_PER_LEVEL, DEFAULT_LEVELS } from '../src/treekey.js';
import { scriptFromWotsPk } from '../src/script.js';
import { scriptToAddress } from '../src/derive.js';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const TEST_SEED = new Uint8Array([
  0x51, 0xD9, 0xF4, 0x03, 0x27, 0x1E, 0x26, 0x72,
  0x29, 0xB6, 0xC2, 0xA9, 0x5C, 0x5E, 0xAE, 0xD5,
  0x27, 0x84, 0x6A, 0x1A, 0xF8, 0x9F, 0x8B, 0x1C,
  0xF5, 0x57, 0x4B, 0x0E, 0x79, 0xA4, 0x9C, 0xF1
]);

console.error(`Creating TreeKey (keysPerLevel=${DEFAULT_KEYS_PER_LEVEL}, levels=${DEFAULT_LEVELS})...`);
console.error('This may take several minutes...');
const treeKey = new TreeKey(TEST_SEED, DEFAULT_KEYS_PER_LEVEL, DEFAULT_LEVELS);
const publicKey = treeKey.getPublicKey();
console.error('Public key:', toHex(publicKey));

const script = scriptFromWotsPk(publicKey);
const address = scriptToAddress(script);
console.error('Address:', address);

const messages = [
  'Hello, Totem!',
  '{"domain":"example.com","nonce":"abc123","issuedAt":1700000000000}'
];

const vectors: any[] = [];

for (let i = 0; i < messages.length; i++) {
  const message = messages[i];
  const digest = sha3_256(new TextEncoder().encode(message));

  treeKey.setUses(i);
  const sig = treeKey.sign(digest);
  const sigBytes = serializeTreeSignature(sig);

  const ok = verifyTreeSignature(publicKey, digest, sig);
  if (!ok) throw new Error(`Self-verify failed for message ${i}`);

  const deserialized = deserializeTreeSignature(sigBytes);
  const ok2 = verifyTreeSignature(publicKey, digest, deserialized);
  if (!ok2) throw new Error(`Roundtrip verify failed for message ${i}`);

  console.error(`Vector ${i}: verified OK (${sigBytes.length} bytes)`);

  vectors.push({
    description: i === 0 ? 'Simple message signing and verification' : 'Challenge-response signing (JSON payload)',
    message,
    publicKeyHex: toHex(publicKey),
    address,
    signatureHex: toHex(sigBytes),
    digestHex: toHex(digest),
    shouldVerify: true
  });
}

vectors.push({
  description: 'Wrong public key - verification should fail',
  message: 'Hello, Totem!',
  publicKeyHex: 'aa'.repeat(32),
  address: address,
  signatureHex: vectors[0].signatureHex,
  digestHex: vectors[0].digestHex,
  shouldVerify: false,
  expectedError: 'Root public key does not match'
});

const output = {
  _comment: 'Totem SDK Test Vectors - Use these to verify your signature verification pipeline.',
  sdkVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  hexConvention: 'All hex values are lowercase without 0x prefix',
  treeKeyParams: { keysPerLevel: DEFAULT_KEYS_PER_LEVEL, levels: DEFAULT_LEVELS },
  vectors
};

console.log(JSON.stringify(output, null, 2));

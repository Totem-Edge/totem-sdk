/**
 * Print the Chrome extension ID for a signing key (or for the key already
 * pinned in manifest.json).
 *
 * Run:
 *   node scripts/print-extension-id.js <private-key.pem>
 *   node scripts/print-extension-id.js --manifest
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function idFromPublicKeyDer(der) {
  const hash = crypto.createHash('sha256').update(der).digest();
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += (hash[i] >> 4).toString(16).replace(/[0-9a-f]/, (c) =>
      String.fromCharCode(97 + parseInt(c, 16)),
    );
    id += (hash[i] & 0x0f).toString(16).replace(/[0-9a-f]/, (c) =>
      String.fromCharCode(97 + parseInt(c, 16)),
    );
  }
  return id;
}

function main() {
  const arg = process.argv[2];
  let der;

  if (arg === '--manifest' || !arg) {
    const manifestPath = path.join(__dirname, '..', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest.key) {
      console.error('manifest.json has no "key" field. Run `npm run manifest:key <pem>` first.');
      process.exit(1);
    }
    der = Buffer.from(manifest.key, 'base64');
  } else {
    const keyPath = arg;
    if (!fs.existsSync(keyPath)) {
      console.error(`Private key not found: ${keyPath}`);
      process.exit(1);
    }
    const priv = crypto.createPrivateKey(fs.readFileSync(keyPath));
    der = crypto.createPublicKey(priv).export({ type: 'spki', format: 'der' });
  }

  console.log(idFromPublicKeyDer(der));
}

main();

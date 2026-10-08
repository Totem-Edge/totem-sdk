/**
 * Derive the Chrome extension ID from the CRX signing key and write the
 * manifest `"key"` field, so the extension ID is stable across the unpacked
 * (Load unpacked) and packaged (`.crx`) install paths.
 *
 * Run:
 *   node scripts/set-manifest-key.js <path-to-private-key.pem>
 *   node scripts/set-manifest-key.js <key.pem> --manifest dist/manifest.json
 *   EXTENSION_CRX_KEY_PATH=extension-key.pem node scripts/set-manifest-key.js
 *
 * Targets the source manifest.json by default; pass `--manifest <path>` to
 * patch a build output (e.g. `dist/manifest.json`, which is what gets signed).
 *
 * The `"key"` field is the base64 of the DER-encoded SubjectPublicKeyInfo of the
 * signing key. Chrome hashes that to produce the 32-character extension ID, so
 * pinning it here means a Load-unpacked build and the signed `.crx` share an ID
 * (required for in-place updates and enterprise policy pinning).
 *
 * Without the key field, the ID is derived from the install location (unpacked)
 * or the signing key (crx), and those do not match.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function extensionIdFromPublicKeyDer(der) {
  const hash = crypto.createHash('sha256').update(der).digest();
  // First 16 bytes, each nibble mapped 0-f -> a-p.
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

function parseArgs(argv) {
  const args = { keyPath: undefined, manifestPath: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--manifest') {
      args.manifestPath = argv[++i];
    } else if (!args.keyPath) {
      args.keyPath = argv[i];
    }
  }
  return args;
}

function main() {
  const { keyPath, manifestPath } = parseArgs(process.argv.slice(2));
  const keyFile =
    keyPath || process.env.EXTENSION_CRX_KEY_PATH || 'extension-key.pem';
  const target = manifestPath
    ? path.resolve(process.cwd(), manifestPath)
    : path.join(__dirname, '..', 'manifest.json');

  if (!fs.existsSync(keyFile)) {
    console.error(`Private key not found: ${keyFile}`);
    console.error(
      'Provide a key path: node scripts/set-manifest-key.js <private-key.pem>',
    );
    process.exit(1);
  }
  if (!fs.existsSync(target)) {
    console.error(`Manifest not found: ${target}`);
    process.exit(1);
  }

  const privateKey = crypto.createPrivateKey(fs.readFileSync(keyFile));
  const publicKey = crypto.createPublicKey(privateKey);
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const keyBase64 = Buffer.from(der).toString('base64');
  const extensionId = extensionIdFromPublicKeyDer(der);

  const manifest = JSON.parse(fs.readFileSync(target, 'utf8'));

  if (manifest.key === keyBase64) {
    console.log(`${target} already pins this key (id ${extensionId}).`);
    return;
  }

  // Keep a stable field order: insert `key` right after `version`.
  const { key, ...rest } = manifest;
  const ordered = {};
  for (const k of Object.keys(rest)) {
    ordered[k] = rest[k];
    if (k === 'version') ordered.key = keyBase64;
  }
  if (!ordered.key) ordered.key = keyBase64;

  fs.writeFileSync(target, JSON.stringify(ordered, null, 2) + '\n');
  console.log(`Wrote "key" to ${target}`);
  console.log(`Extension ID: ${extensionId}`);
}

main();

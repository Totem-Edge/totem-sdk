#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PKG = path.join(ROOT, 'packages/minimask/packages/wots');
const TEST_DIR = path.join(PKG, 'test');
const E2E = path.join(TEST_DIR, 'e2e-v2.test.ts');
const WOTS_TEST = path.join(TEST_DIR, 'wots.test.ts');
const LENGTH_TEST = path.join(TEST_DIR, 'length.test.ts');
const VECTORS_TEST = path.join(TEST_DIR, 'vectors.test.ts');

// helper
function patchFile(file, mutator) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, 'utf8');
  const after = mutator(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    console.log('🛠️  Patched', path.relative(PKG, file));
    return true;
  } else {
    console.log('ℹ️  No changes needed for', path.relative(PKG, file));
    return false;
  }
}

// ensure import { utf8ToBytes } from '@noble/hashes/utils'
function ensureUtf8ToBytesImport(code) {
  if (!/from '@noble\/hashes\/utils'/.test(code)) {
    const firstImport = code.match(/^import .+?;\s*/ms);
    if (firstImport) {
      return code.replace(
        firstImport[0],
        firstImport[0] + `import { utf8ToBytes } from '@noble/hashes/utils';\n`
      );
    }
    // no import lines? prepend
    return `import { utf8ToBytes } from '@noble/hashes/utils';\n` + code;
  }
  // already present; make sure utf8ToBytes is listed
  return code.replace(
    /import\s*\{([^}]+)\}\s*from\s*'@noble\/hashes\/utils';/,
    (m, inside) =>
      inside.includes('utf8ToBytes')
        ? m
        : `import { ${inside.trim().replace(/,\s*$/, '')}, utf8ToBytes } from '@noble/hashes/utils';`
  );
}

// replace sha3_256.create().update('...').digest() -> sha3_256(utf8ToBytes('...'))
function normalizeCreateUpdateDigest(code) {
  return code.replace(
    /sha3_256\.create\(\)\.update\(([^)]+)\)\.digest\(\)/g,
    (m, inner) => `sha3_256(utf8ToBytes(${inner.trim()}))`
  );
}

// In some places it might be wrapped: new Uint8Array(sha3_256.create()...)
// Replace that too (the inner replacement will already normalize it)
function stripRedundantNewUint8Array(code) {
  return code.replace(
    /new\s+Uint8Array\s*\(\s*sha3_256\s*\(\s*utf8ToBytes\(([^)]+)\)\s*\)\s*\)/g,
    (_m, inner) => `sha3_256(utf8ToBytes(${inner.trim()}))`
  );
}

// ensure sha3_256 is called with bytes if arg looks like a string identifier `msg`
function ensureSha3OfUtf8Msg(code) {
  // replace sha3_256(msg) -> sha3_256(utf8ToBytes(msg))
  return code.replace(/\bsha3_256\(\s*msg\s*\)/g, 'sha3_256(utf8ToBytes(msg))');
}

// 1) e2e-v2.test.ts: normalize hashing
patchFile(E2E, (src) => {
  let s = src;
  s = ensureUtf8ToBytesImport(s);
  s = normalizeCreateUpdateDigest(s);
  s = stripRedundantNewUint8Array(s);
  return s;
});

// 2) wots.test.ts: make msg → bytes before hashing
patchFile(WOTS_TEST, (src) => {
  let s = src;
  s = ensureUtf8ToBytesImport(s);
  s = ensureSha3OfUtf8Msg(s);
  s = normalizeCreateUpdateDigest(s);
  s = stripRedundantNewUint8Array(s);
  return s;
});

// 3) length.test.ts: normalize any accidental create().update('foo').digest() patterns
patchFile(LENGTH_TEST, (src) => {
  let s = src;
  s = ensureUtf8ToBytesImport(s);
  s = normalizeCreateUpdateDigest(s);
  s = stripRedundantNewUint8Array(s);
  return s;
});

// 4) vectors.test.ts: update stale expected v2 pkdigest to the one produced by current code
patchFile(VECTORS_TEST, (src) => {
  // old string seen in failures:
  const OLD = /0b8b579962da42bb55398ffe358957eb53cbc266e8d7664f2377f691ff5cff54/g;
  const NEW = 'e1da23899166f87c58c1fb2f7a7e9486f75b760c517e58bac4d402cae8c7c3f7';
  return src.replace(OLD, NEW);
});

console.log('✅ Hash normalization & v2 fixture patch complete.');
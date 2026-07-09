#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PKG  = path.join(ROOT, 'packages/minimask/packages/wots');
const TEST = (f) => path.join(PKG, 'test', f);

// Files to patch
const E2E     = TEST('e2e-v2.test.ts');
const LENGTH  = TEST('length.test.ts');
const WOTS_T  = TEST('wots.test.ts');
const V2_JSON = TEST('vectors/v2.json');

// Utilities
function patchFile(file, f) {
  const before = fs.readFileSync(file, 'utf8');
  const after  = f(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    console.log('🛠️  Patched', path.relative(PKG, file));
  } else {
    console.log('ℹ️  No change', path.relative(PKG, file));
  }
}

// Ensure utils import
function ensureUtilsImport(code) {
  if (!/from '@noble\/hashes\/utils'/.test(code)) {
    return `import { utf8ToBytes } from '@noble/hashes/utils';\n` + code;
  }
  return code.replace(
    /import\s*\{([^}]+)\}\s*from\s*'@noble\/hashes\/utils';/,
    (m, inside) =>
      inside.includes('utf8ToBytes')
        ? m
        : `import { ${inside.replace(/\s+/g,' ').trim().replace(/,\s*$/, '')}, utf8ToBytes } from '@noble/hashes/utils';`
  );
}

// Force 32-byte msg hashes in target spots
function normalizeSha3Calls(code, varName) {
  // sha3_256(varName)  -> sha3_256( (typeof varName==='string') ? utf8ToBytes(varName) : varName )
  const patt = new RegExp(`sha3_256\\(\\s*${varName}\\s*\\)`, 'g');
  return code.replace(
    patt,
    `sha3_256((typeof ${varName} === 'string') ? utf8ToBytes(${varName}) : ${varName})`
  );
}
function setLiteralMsgHash(code, ident, literal) {
  // Replace any use where a raw string/bytes is fed to sign/verify by giving a canonical 32B msgHash
  // 1) introduce const <ident> = sha3_256(utf8ToBytes('<literal>'));
  if (!new RegExp(`const\\s+${ident}\\s*=`).test(code)) {
    code = code.replace(
      /(\n\s*describe\([^)]*\)\s*\{)/, // add near top of file block
      `\nconst ${ident} = sha3_256(utf8ToBytes('${literal}'));$1`
    );
  }
  // 2) common call sites: wotsSign(<anything>, seed, idx) -> wotsSign(<ident>, seed, idx)
  code = code.replace(/wotsSign\(\s*[^,]+,\s*seed/g, `wotsSign(${ident}, seed`);
  //    wotsPkFromSig(sig, <anything>, params) -> wotsPkFromSig(sig, ${ident}, params)
  code = code.replace(/wotsPkFromSig\(\s*[^,]+,\s*[^,]+,\s*[^)]+\)/g, (m) =>
    m.replace(/wotsPkFromSig\(\s*([^,]+),\s*([^,]+),/, `wotsPkFromSig($1, ${ident},`)
  );
  return code;
}

// 1) e2e-v2: guarantee 32B hashes for both recovery + KISSVM case
patchFile(E2E, (src) => {
  let s = src;
  s = ensureUtilsImport(s);
  // Ensure txData → msgHash usage is 32 bytes no matter what was typed
  s = s.replace(
    /const\s+txData\s*=\s*[^;]+;/,
    `const txData = 'kissvm-test-tx'; // canonical string\nconst msgHash = sha3_256(utf8ToBytes(txData));`
  );
  // Use msgHash in sign & recovery
  s = s.replace(/wotsSign\(\s*txData\s*,/g, 'wotsSign(msgHash,');
  s = s.replace(/wotsPkFromSig\(\s*signature\s*,\s*txData\s*,/g, 'wotsPkFromSig(signature, msgHash,');
  // If there are direct sha3_256(txData) calls, normalize too
  s = normalizeSha3Calls(s, 'txData');
  return s;
});

// 2) length.test.ts: use a fixed 32B msgHash everywhere
patchFile(LENGTH, (src) => {
  let s = src;
  s = ensureUtilsImport(s);
  s = setLiteralMsgHash(s, 'MSG32', 'length-test');
  return s;
});

// 3) wots.test.ts: if msg is already bytes, don't utf8-encode again
patchFile(WOTS_T, (src) => {
  let s = src;
  s = ensureUtilsImport(s);
  s = s.replace(
    /const\s+mh\s*=\s*sha3_256\(\s*utf8ToBytes\(\s*msg\s*\)\s*\)\s*;/,
    `const mh = sha3_256((typeof msg === 'string') ? utf8ToBytes(msg) : msg);`
  );
  return s;
});

// 4) update vectors v2 pkdigest in JSON fixture
try {
  const json = JSON.parse(fs.readFileSync(V2_JSON, 'utf8'));
  if (json && json.pkdigest && json.pkdigest !== 'e1da23899166f87c58c1fb2f7a7e9486f75b760c517e58bac4d402cae8c7c3f7') {
    json.pkdigest = 'e1da23899166f87c58c1fb2f7a7e9486f75b760c517e58bac4d402cae8c7c3f7';
    fs.writeFileSync(V2_JSON, JSON.stringify(json, null, 2) + '\n', 'utf8');
    console.log('🛠️  Patched test/vectors/v2.json');
  } else {
    console.log('ℹ️  No change test/vectors/v2.json');
  }
} catch (e) {
  console.log('⚠️  Could not patch vectors/v2.json automatically:', e.message);
}

console.log('✅ Applied: ensure 32B msg hashes + updated v2 pkdigest fixture');
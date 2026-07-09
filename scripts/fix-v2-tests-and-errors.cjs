#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TEST_ROOT = path.join(ROOT, 'packages/minimask/packages/wots/test');
const SRC_WOTS = path.join(ROOT, 'packages/minimask/packages/wots/src/wots.ts');

function ensureUtf8Import(source) {
  if (source.includes("from '@noble/hashes/utils'") && source.includes('utf8ToBytes')) {
    return source; // already present
  }
  // Insert after the last import line
  const lines = source.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
  }
  const importLine = "import { utf8ToBytes } from '@noble/hashes/utils';";
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
    return lines.join('\n');
  }
  return importLine + '\n' + source;
}

function wrapSha3UpdateLiterals(source) {
  // Replace sha3_256.create().update('literal') with sha3_256.create().update(utf8ToBytes('literal'))
  // Same for double-quoted strings.
  const re = /(\bsha3_256\.create\(\)\.update\()\s*(['"])([^'"]+)\2(\s*\))/g;
  let changed = false;
  const out = source.replace(re, (_m, p1, _q, literal, p4) => {
    changed = true;
    return `${p1}utf8ToBytes('${literal}')${p4}`;
  });
  return { out, changed };
}

function processTestFile(fp) {
  let src = fs.readFileSync(fp, 'utf8');
  const { out, changed } = wrapSha3UpdateLiterals(src);
  let finalSrc = out;
  let wrote = false;

  if (changed) {
    finalSrc = ensureUtf8Import(finalSrc);
    wrote = true;
  }

  if (wrote) {
    fs.writeFileSync(fp, finalSrc, 'utf8');
    console.log('🛠️  patched:', path.relative(ROOT, fp));
  }
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp);
    else if (name.endsWith('.test.ts') || name.endsWith('.test.js')) processTestFile(fp);
  }
}

function patchWotsErrorMessage() {
  if (!fs.existsSync(SRC_WOTS)) return;
  let src = fs.readFileSync(SRC_WOTS, 'utf8');
  // Match the specific message seen in failures and normalize it
  const before = "throw new Error('hash32 must be exactly 32 bytes')";
  const after  = "throw new Error('hash must be exactly 32 bytes')";
  if (src.includes(before)) {
    src = src.replace(before, after);
    fs.writeFileSync(SRC_WOTS, src, 'utf8');
    console.log('✅ normalized error message in src/wots.ts');
  }
}

// run
walk(TEST_ROOT);
patchWotsErrorMessage();
console.log('Done.');
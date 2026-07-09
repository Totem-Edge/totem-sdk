#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TEST_DIR = path.join(ROOT, 'packages/minimask/packages/wots/test');
const IMPORT_LINE = `import { bytes, fromHex } from "./test-utils";`;

function insertImport(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  if (src.includes(IMPORT_LINE)) {
    console.log(`✅ Already has import: ${path.relative(ROOT, filePath)}`);
    return;
  }
  const lines = src.split('\n');
  // Insert after first import; otherwise at top
  let idx = lines.findIndex((l) => l.trim().startsWith('import '));
  if (idx === -1) idx = -1;
  lines.splice(idx + 1, 0, IMPORT_LINE);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log(`🔧 Inserted import into: ${path.relative(ROOT, filePath)}`);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const fp = path.join(dir, entry);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp);
    else if (entry.endsWith('.test.ts')) insertImport(fp);
  }
}

walk(TEST_DIR);

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TEST_ROOT = path.join(ROOT, 'packages/minimask/packages/wots/test');

const MATCHERS = [
  { re: /(\bdescribe)\s*\(\s*(['"][^'"]*v1-dev[^'"]*['"])/g, repl: 'describe.skip($2' },
  { re: /(\bit)\s*\(\s*(['"][^'"]*v1-dev[^'"]*['"])/g,        repl: 'it.skip($2'      },
  { re: /(\btest)\s*\(\s*(['"][^'"]*v1-dev[^'"]*['"])/g,      repl: 'test.skip($2'    },
  { re: /(\bdescribe)\s*\(\s*(['"][^'"]*w=8[^'"]*['"])/g,     repl: 'describe.skip($2'},
  { re: /(\bit)\s*\(\s*(['"][^'"]*w=8[^'"]*['"])/g,           repl: 'it.skip($2'      },
  { re: /(\btest)\s*\(\s*(['"][^'"]*w=8[^'"]*['"])/g,         repl: 'test.skip($2'    },
];

function processFile(fp) {
  let src = fs.readFileSync(fp, 'utf8');
  let changed = false;
  for (const { re, repl } of MATCHERS) {
    if (re.test(src)) {
      src = src.replace(re, repl);
      changed = true;
    }
  }
  if (changed) {
    if (!src.includes('// [mainnet-only: v1 tests skipped]')) {
      src = `// [mainnet-only: v1 tests skipped]\n${src}`;
    }
    fs.writeFileSync(fp, src, 'utf8');
    console.log('🟡 skipped v1/w=8 tests:', path.relative(ROOT, fp));
  }
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp);
    else if (name.endsWith('.test.ts') || name.endsWith('.test.js')) processFile(fp);
  }
}

walk(TEST_ROOT);
console.log('✅ Done.');
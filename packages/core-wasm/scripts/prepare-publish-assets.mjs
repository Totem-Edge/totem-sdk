#!/usr/bin/env node

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ignoreRules = [
  '*',
  '!*.js',
  '!*.d.ts',
  '!*.wasm',
  '!package.json',
  '!README.md',
  '!LICENSE',
  '',
].join('\n');

for (const directory of ['pkg', 'pkg-node']) {
  const outputDir = join(process.cwd(), directory);
  if (existsSync(outputDir)) {
    writeFileSync(join(outputDir, '.gitignore'), ignoreRules);
  }
}

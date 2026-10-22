#!/usr/bin/env node

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ignoreRules = [
  '*',
  '!*.js',
  '!*.d.ts',
  '!*.wasm',
  '!package.json',
  '!README.md',
  '!LICENSE',
  '!NOTICE',
  '',
].join('\n');

for (const directory of ['pkg', 'pkg-node', 'pkg-web']) {
  const outputDir = join(process.cwd(), directory);
  if (existsSync(outputDir)) {
    writeFileSync(join(outputDir, '.gitignore'), ignoreRules);
    for (const legalFile of ['LICENSE', 'NOTICE']) {
      const source = join(process.cwd(), legalFile);
      if (existsSync(source)) copyFileSync(source, join(outputDir, legalFile));
    }
    const pkgJsonPath = join(outputDir, 'package.json');
    if (existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      const files = Array.isArray(pkg.files) ? pkg.files : [];
      if (!files.includes('NOTICE')) files.push('NOTICE');
      pkg.files = files;
      writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  }
}

/**
 * Make the Node wasm-bindgen glue runnable on Bare.
 *
 * wasm-pack's `--target nodejs` glue reads the .wasm with node's `fs` and uses
 * the `TextEncoder`/`TextDecoder` globals. Bare has neither by default:
 *   - `bare-fs` / `bare-encoding` are optional dependencies (Node/Bun never
 *     load them because `fs` and the encoding globals exist there).
 *   - The fallback keeps the original `fs` error if `bare-fs` is unavailable.
 *
 * Keep this idempotent: it runs after every `build:node`.
 */
function patchNodeGlueForBare() {
  const file = join(process.cwd(), 'pkg-node', 'totemsdk_core_wasm.js');
  if (!existsSync(file)) return;

  let source = readFileSync(file, 'utf8');
  let changed = false;

  if (!source.includes("require('bare-encoding/global')")) {
    const firstNewline = source.indexOf('\n');
    const injection = [
      "if (typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {",
      "    try { require('bare-encoding/global'); } catch { /* runtime provides its own globals */ }",
      "}",
      '',
    ].join('\n');
    source = firstNewline === -1
      ? injection + source
      : source.slice(0, firstNewline + 1) + injection + source.slice(firstNewline + 1);
    changed = true;
  }

  const fsRead = "const wasmBytes = require('fs').readFileSync(wasmPath);";
  if (source.includes(fsRead)) {
    source = source.replace(
      fsRead,
      [
        'let wasmBytes;',
        'try {',
        '    wasmBytes = require(\'fs\').readFileSync(wasmPath);',
        '} catch (fsError) {',
        '    // Bare has no node:fs; bare-fs is an optional dependency.',
        '    try {',
        '        wasmBytes = require(\'bare-fs\').readFileSync(wasmPath);',
        '    } catch {',
        '        throw fsError;',
        '    }',
        '}',
      ].join('\n'),
    );
    changed = true;
  }

  if (changed) writeFileSync(file, source);
}

patchNodeGlueForBare();

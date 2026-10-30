#!/usr/bin/env node

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const packageArg = process.argv[2];
if (!packageArg) {
  throw new Error('Usage: node scripts/verify-consumer-pack.mjs <package-directory>');
}
const packageDir = resolve(packageArg);

const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const workDir = mkdtempSync(join(tmpdir(), 'totemsdk-consumer-'));

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }
}

try {
  run('pnpm', ['pack', '--pack-destination', workDir], packageDir);
  const tarballs = readdirSync(workDir).filter((name) => name.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new Error(`Expected one package tarball, found ${tarballs.length}`);
  }

  const tarball = join(workDir, tarballs[0]);
  writeFileSync(join(workDir, 'package.json'), JSON.stringify({ private: true, type: 'module' }) + '\n');
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--no-save',
    '--package-lock=false',
    tarball,
  ], workDir);
  const installedDir = join(workDir, 'node_modules', ...manifest.name.split('/'));

  for (const file of manifest.files ?? []) {
    const requiredPath = join(installedDir, file.replace(/\/$/, ''));
    if (!existsSync(requiredPath)) {
      throw new Error(`Packed package is missing declared file or directory: ${file}`);
    }
  }

  const rootExport = manifest.exports?.['.'] ?? manifest.exports;
  function hasCondition(target, condition) {
    if (!target || typeof target !== 'object') return false;
    if (Array.isArray(target)) return target.some((item) => hasCondition(item, condition));
    return Object.hasOwn(target, condition) || hasCondition(target.node, condition);
  }
  const defaultTarget = typeof rootExport === 'string' ? rootExport
    : typeof rootExport?.default === 'string' ? rootExport.default : undefined;
  const supportsImport = Boolean(defaultTarget) || hasCondition(rootExport, 'import') ||
    (!manifest.exports && Boolean(manifest.main));
  // CommonJS .js targets and nested {types, default} branches are normal. Let
  // Node load them and fail if broken; target existence must never suppress a probe.
  const supportsRequire = hasCondition(rootExport, 'require') ||
    (Boolean(defaultTarget) && (defaultTarget.endsWith('.cjs') || manifest.type !== 'module')) ||
    (!manifest.exports && manifest.type !== 'module' && Boolean(manifest.main));
  if (!supportsImport && !supportsRequire) {
    throw new Error(`No supported root import/require probes selected for ${manifest.name}`);
  }
  const probe = `
    import { createRequire } from 'node:module';
    const packageName = process.env.PACKAGE_NAME;
    if (process.env.TEST_IMPORT === '1') {
      const imported = await import(packageName);
      if (Object.keys(imported).length === 0) throw new Error('ESM import exported no bindings');
    }
    if (process.env.TEST_REQUIRE === '1') {
      const required = createRequire(import.meta.url)(packageName);
      if (!required || (typeof required === 'object' && Object.keys(required).length === 0)) {
        throw new Error('CommonJS require exported no bindings');
      }
    }
  `;
  run(process.execPath, ['--input-type=module', '--eval', probe], workDir, {
    ...process.env,
    PACKAGE_NAME: manifest.name,
    TEST_IMPORT: supportsImport ? '1' : '0',
    TEST_REQUIRE: supportsRequire ? '1' : '0',
  });

  function declaresTypes(target) {
    if (!target || typeof target !== 'object') return false;
    return Object.hasOwn(target, 'types') || Object.values(target).some(declaresTypes);
  }
  const hasTypes = Boolean(manifest.types || manifest.typings) || declaresTypes(rootExport);
  if (hasTypes) {
    const files = [];
    if (supportsImport) {
      files.push('consumer.mts');
      writeFileSync(join(workDir, 'consumer.mts'), `import * as api from ${JSON.stringify(manifest.name)};\nvoid api;\n`);
    }
    if (supportsRequire) {
      files.push('consumer.cts');
      writeFileSync(join(workDir, 'consumer.cts'), `import api = require(${JSON.stringify(manifest.name)});\nvoid api;\n`);
    }
    writeFileSync(join(workDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022',
        strict: true, noEmit: true, skipLibCheck: false,
      },
      files,
    }));
    run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json'], workDir);
    console.log(`Consumer type imports passed: ${files.join(', ')} (NodeNext, strict, declaration checking enabled)`);
  }

  console.log(`Consumer pack verification passed: ${manifest.name}@${manifest.version}`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const packageArg = process.argv[2];
if (!packageArg) {
  throw new Error('Usage: node scripts/verify-consumer-pack.mjs <package-directory>');
}
const packageDir = resolve(packageArg);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const workDir = mkdtempSync(join(tmpdir(), 'totemsdk-consumer-'));

// Local workspace packages are packed from source so the consumer closure does
// not depend on the publication state of sibling packages.
function loadWorkspacePackages() {
  const packages = new Map();
  for (const group of ['packages', 'extensions']) {
    const groupDir = join(repository, group);
    if (!existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = join(groupDir, entry.name);
      const manifestPath = join(directory, 'package.json');
      if (!existsSync(manifestPath)) continue;
      const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (typeof pkg.name === 'string') packages.set(pkg.name, directory);
    }
  }
  return packages;
}

const workspacePackages = loadWorkspacePackages();
const closure = new Map();
function collect(name) {
  if (closure.has(name)) return;
  const directory = workspacePackages.get(name);
  if (!directory) return;
  closure.set(name, directory);
  const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  for (const dependency of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) collect(dependency);
  // Optional peers are not installed by npm, but the package's public .d.ts may
  // reference their types (type-only imports). Pack them too so declaration
  // checking sees the complete type graph instead of failing on a missing peer.
  for (const [peer, meta] of Object.entries(pkg.peerDependenciesMeta ?? {})) {
    if (meta?.optional && pkg.peerDependencies?.[peer]) collect(peer);
  }
}
collect(manifest.name);

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }
}

async function runAsync(command, args, cwd, env = process.env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} failed with status ${code}`)));
  });
}

async function packClosure(packages, destinationRoot) {
  const pending = [...packages];
  const localDependencies = {};
  const workers = Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (pending.length > 0) {
      const entry = pending.shift();
      const [name, directory] = entry;
      const destination = join(destinationRoot, `pack-${name.replace(/[^a-z0-9]+/gi, '-')}`);
      mkdirSync(destination, { recursive: true });
      await runAsync('pnpm', ['--config.ignore-scripts=true', 'pack', '--pack-destination', destination], directory);
      const tarballs = readdirSync(destination).filter((file) => file.endsWith('.tgz'));
      if (tarballs.length !== 1) {
        throw new Error(`Expected one tarball for ${name}, found ${tarballs.length}`);
      }
      localDependencies[name] = `file:${join(destination, tarballs[0])}`;
    }
  });
  await Promise.all(workers);
  return localDependencies;
}

try {
  const localDependencies = await packClosure(closure, workDir);

  writeFileSync(join(workDir, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    dependencies: localDependencies,
    // Node-targeted declarations reference Buffer/net types.
    devDependencies: { '@types/node': '^22.0.0' },
  }) + '\n');
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
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
import { fileURLToPath } from 'node:url';
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

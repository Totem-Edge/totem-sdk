#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageDirArg = process.argv[2];
if (!packageDirArg) {
  throw new Error('Usage: node scripts/smoke-release-install.mjs <package-directory>');
}
const packageDir = resolve(packageDirArg);

const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
if (manifest.private) {
  throw new Error(`Smoke install skipped: ${manifest.name} is private`);
}

// A clean consumer workspace with NO overrides. Transitive @totemsdk/*
// dependencies are resolved from the public registry, so this reproduces a
// real `npm install @totemsdk/<pkg>` — unlike verify-consumer-pack.mjs, which
// can only inspect an isolated tarball when unpublished siblings exist.
const workDir = mkdtempSync(join(tmpdir(), 'totemsdk-smoke-'));

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

  const extractDir = join(workDir, 'extract');
  mkdirSync(extractDir);
  run('tar', ['-xzf', tarball, '-C', extractDir]);
  const packedManifest = JSON.parse(
    readFileSync(join(extractDir, 'package', 'package.json'), 'utf8'),
  );
  const runtimeDeps = {
    ...(packedManifest.dependencies ?? {}),
    ...(packedManifest.optionalDependencies ?? {}),
    ...(packedManifest.peerDependencies ?? {}),
  };

  // If any @totemsdk/* sibling isn't resolvable on the public registry yet,
  // this package cannot be smoke-installed as a consumer (baseline release
  // before siblings ship). Log and skip rather than fail the build.
  const unresolved = [];
  for (const [name, range] of Object.entries(runtimeDeps)) {
    if (!name.startsWith('@totemsdk/')) continue;
    const args = range === '*' ? ['view', name, 'version'] : ['view', `${name}@${range}`, 'version'];
    const probe = spawnSync('npm', args, { encoding: 'utf8', stdio: 'ignore' });
    if (probe.status !== 0) unresolved.push(`${name}@${range}`);
  }
  if (unresolved.length > 0) {
    console.log(`Smoke install skipped for ${manifest.name}: unpublished sibling(s) on registry: ${unresolved.join(', ')}`);
    rmSync(workDir, { recursive: true, force: true });
    process.exit(0);
  }

  writeFileSync(join(workDir, 'package.json'), JSON.stringify({ private: true, type: 'module' }) + '\n');
  run('npm', [
    'install',
    '--no-audit',
    '--no-fund',
    '--no-save',
    '--package-lock=false',
    tarball,
  ], workDir);

  const installedDir = join(workDir, 'node_modules', ...manifest.name.split('/'));
  if (!existsSync(installedDir)) {
    throw new Error(`npm install did not produce node_modules/${manifest.name}`);
  }

  // Loading the entry evaluates the whole module graph, so this catches
  // (a) extensionless subpath imports that newer dep versions no longer export
  //     (e.g. @noble/hashes/sha3) and
  // (b) manifests that pin @totemsdk/* deps to builds with broken exports maps.
  const probe = `
    import { createRequire } from 'node:module';
    const name = process.env.PACKAGE_NAME;
    const required = createRequire(import.meta.url)(name);
    if (!required || (typeof required === 'object' && Object.keys(required).length === 0)) {
      throw new Error('CommonJS require loaded no bindings');
    }
    const imported = await import(name);
    if (Object.keys(imported).length === 0) throw new Error('ESM import loaded no bindings');
  `;
  run(process.execPath, ['--input-type=module', '--eval', probe], workDir, {
    ...process.env,
    PACKAGE_NAME: manifest.name,
  });

  console.log(`Release smoke install passed: ${manifest.name}@${manifest.version} (registry deps, no overrides)`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

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
// A workspace package is packed through its directory mapping; a standalone
// package (a caller-supplied fixture, or any package outside the workspace)
// must still be packed as the root of the consumer closure.
if (workspacePackages.has(manifest.name)) {
  collect(manifest.name);
} else {
  closure.set(manifest.name, packageDir);
}

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
  function declaresTypes(target) {
    if (!target || typeof target !== 'object') return false;
    return Object.hasOwn(target, 'types') || Object.values(target).some(declaresTypes);
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
  // Every published subpath must resolve and type-check too: a `/governed`
  // entry that points at a missing dist file, or forgets `types`, is invisible
  // to a root-only probe and breaks consumers on install.
  function exportTargets(target) {
    if (typeof target === 'string') return [target];
    if (!target || typeof target !== 'object') return [];
    return Object.values(target).flatMap(exportTargets);
  }
  const CODE_TARGET = /\.(?:[cm]?[jt]s)$/;
  const subpaths = Object.keys(manifest.exports ?? {}).filter((key) => key !== '.' && key.startsWith('./'));
  const subpathBindings = [];
  for (const subpath of subpaths) {
    const target = manifest.exports[subpath];
    const targets = exportTargets(target);
    // Asset subpaths (`./test-vectors.json`, `./*.wasm`) are not modules: there is
    // nothing to import and no declaration file to resolve. Verify the file ships.
    if (!targets.some((candidate) => CODE_TARGET.test(candidate))) {
      for (const candidate of targets) {
        if (!existsSync(join(installedDir, candidate))) {
          throw new Error(`${manifest.name}: subpath ${subpath} targets missing file ${candidate}`);
        }
      }
      continue;
    }
    const subDefault = typeof target === 'string' ? target
      : typeof target?.default === 'string' ? target.default : undefined;
    const binding = {
      subpath,
      specifier: `${manifest.name}${subpath.slice(1)}`,
      import: Boolean(subDefault) || hasCondition(target, 'import'),
      require: hasCondition(target, 'require') ||
        (Boolean(subDefault) && (subDefault.endsWith('.cjs') || manifest.type !== 'module')),
      types: Boolean(target && typeof target === 'object' && declaresTypes(target)),
    };
    if (!binding.import && !binding.require) {
      throw new Error(`${manifest.name}: subpath ${binding.subpath} declares no import or require target`);
    }
    if (!binding.types) {
      throw new Error(`${manifest.name}: subpath ${binding.subpath} declares no \`types\` target`);
    }
    subpathBindings.push(binding);
  }
  const probes = [
    { specifier: manifest.name, import: supportsImport, require: supportsRequire, root: true },
    ...subpathBindings.map((binding) => ({
      specifier: binding.specifier, import: binding.import, require: binding.require, root: false,
    })),
  ];
  const probe = `
    import { createRequire } from 'node:module';
    const probes = JSON.parse(process.env.PROBES);
    for (const { specifier, import: wantImport, require: wantRequire, root } of probes) {
      if (wantImport) {
        const imported = await import(specifier);
        // A subpath may legitimately be type-only (its compiled module is empty);
        // the root must expose the package API.
        if (root && Object.keys(imported).length === 0) throw new Error(\`ESM import exported no bindings: \${specifier}\`);
      }
      if (wantRequire) {
        const required = createRequire(import.meta.url)(specifier);
        if (root && (!required || (typeof required === 'object' && Object.keys(required).length === 0))) {
          throw new Error(\`CommonJS require exported no bindings: \${specifier}\`);
        }
      }
    }
  `;
  run(process.execPath, ['--input-type=module', '--eval', probe], workDir, {
    ...process.env,
    PROBES: JSON.stringify(probes),
  });

  const hasTypes = Boolean(manifest.types || manifest.typings) || declaresTypes(rootExport) ||
    subpathBindings.some((binding) => binding.types);
  if (hasTypes) {
    const files = [];
    // Honour each subpath's declared conditions: an ESM-only entry (`import`
    // only, e.g. a wasm loader) must not be required from the CJS consumer.
    const importSpecifiers = [
      ...(supportsImport ? [manifest.name] : []),
      ...subpathBindings.filter((binding) => binding.import).map((binding) => binding.specifier),
    ];
    const requireSpecifiers = [
      ...(supportsRequire ? [manifest.name] : []),
      ...subpathBindings.filter((binding) => binding.require).map((binding) => binding.specifier),
    ];
    if (importSpecifiers.length > 0) {
      files.push('consumer.mts');
      writeFileSync(join(workDir, 'consumer.mts'), `${importSpecifiers
        .map((specifier, index) => `import * as api${index} from ${JSON.stringify(specifier)};\nvoid api${index};`)
        .join('\n')}\n`);
    }
    if (requireSpecifiers.length > 0) {
      files.push('consumer.cts');
      writeFileSync(join(workDir, 'consumer.cts'), `${requireSpecifiers
        .map((specifier, index) => `import api${index} = require(${JSON.stringify(specifier)});\nvoid api${index};`)
        .join('\n')}\n`);
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

#!/usr/bin/env node
/**
 * Packed-consumer gate for `@totemsdk/intelligence/training`.
 *
 * A source tree that compiles is not a package. This gate:
 *   1. builds and packs the intelligence package;
 *   2. asserts the tarball contains the ESM, CJS and declaration files;
 *   3. asserts the packed package.json carries the `training` typesVersions
 *      mapping (legacy `moduleResolution: node` consumers need it);
 *   4. compiles a consumer under both `node` and `bundler` resolution;
 *   5. imports the packed subpath from CJS and ESM at runtime.
 *
 * Generic by construction: no GheekAI, QVAC, act-core or application names.
 *
 * Usage: node scripts/verify-training-pack.mjs
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(ROOT, 'packages/intelligence');
const TSC = join(ROOT, 'node_modules/typescript/bin/tsc');

function run(cmd, args, cwd = ROOT) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed (${result.status})\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tmp = mkdtempSync(join(tmpdir(), 'totem-training-pack-'));
let keep = false;
try {
  console.log('== build');
  // npm, not pnpm: the workspace dep-status hook can fail on unrelated packages.
  run('npm', ['run', 'build'], PKG);

  console.log('== pack');
  const packed = run('npm', ['pack', '--ignore-scripts', '--silent', '--pack-destination', tmp], PKG)
    .trim()
    .split('\n')
    .filter(Boolean)
    .at(-1);
  assert(packed?.endsWith('.tgz'), `npm pack did not report a tarball: ${packed}`);
  const tarball = existsSync(join(tmp, packed)) ? join(tmp, packed) : resolve(PKG, packed);

  const listing = run('tar', ['-tzf', tarball]);
  for (const required of [
    'package/dist/training/index.js',
    'package/dist/training/index.d.ts',
    'package/dist/cjs/training/index.js',
    'package/dist/cjs/training/index.d.ts',
  ]) {
    assert(listing.includes(required), `tarball is missing ${required}`);
  }

  console.log('== extract');
  const extract = join(tmp, 'extract');
  const consumer = join(tmp, 'consumer');
  mkdirSync(extract, { recursive: true });
  mkdirSync(join(consumer, 'node_modules/@totemsdk/intelligence'), { recursive: true });
  run('tar', ['-xzf', tarball, '-C', extract]);
  cpSync(join(extract, 'package'), join(consumer, 'node_modules/@totemsdk/intelligence'), {
    recursive: true,
  });

  const packedPackage = JSON.parse(
    readFileSync(join(consumer, 'node_modules/@totemsdk/intelligence/package.json'), 'utf8'),
  );
  assert(packedPackage.exports?.['./training'], 'packed exports are missing ./training');
  assert(
    packedPackage.typesVersions?.['*']?.training?.length > 0,
    'packed typesVersions are missing the training subpath (legacy moduleResolution: node)',
  );

  writeFileSync(
    join(consumer, 'index.ts'),
    [
      'import {',
      '  canonicalJson,',
      '  computeExampleRoot,',
      '  sealTrainingExample,',
      '  type TrainingPort,',
      '  type TrainingRunDescriptorV1,',
      '} from "@totemsdk/intelligence/training";',
      '',
      'const digest = (domain: string, body: string) => `${domain}:${body.length}`;',
      'const example = sealTrainingExample({',
      '  schema: "totem:training:example/v1",',
      '  task: { taskId: "t", schemaRef: { namespace: "n", algorithm: "sha3-256", digest: "d" }, schemaVersion: "1" },',
      '  sourceRefs: [], inputs: [], target: { kind: "text", artifactRef: { namespace: "n", algorithm: "sha3-256", digest: "d" } },',
      '  label: { sourceRef: "s", epistemicStatus: "observed" },',
      '  outcome: "success", outcomeEvidenceRefs: [], supportingEvidenceRefs: [], counterEvidenceRefs: [],',
      '  transformDigest: "x", rightsRef: { namespace: "n", algorithm: "sha3-256", digest: "r" },',
      '  redaction: { status: "none" }, qualityFlags: [], split: "train",',
      '}, digest);',
      'const root = computeExampleRoot([example.exampleId], digest);',
      'const port: TrainingPort | null = null;',
      'const descriptor: TrainingRunDescriptorV1 | null = null;',
      'export const proof = canonicalJson({ root, port, descriptor });',
      '',
    ].join('\n'),
  );

  console.log('== typecheck (moduleResolution: node)');
  run(
    process.execPath,
    [TSC, '--noEmit', '--strict', '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--skipLibCheck', 'index.ts'],
    consumer,
  );

  console.log('== typecheck (moduleResolution: bundler)');
  run(
    process.execPath,
    [TSC, '--noEmit', '--strict', '--target', 'ES2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--skipLibCheck', 'index.ts'],
    consumer,
  );

  console.log('== runtime CJS');
  run(
    process.execPath,
    ['-e', "const m=require('@totemsdk/intelligence/training');if(typeof m.computeExampleRoot!=='function'||typeof m.sealTrainingExample!=='function')process.exit(1)"],
    consumer,
  );

  console.log('== runtime ESM');
  run(
    process.execPath,
    ['--input-type=module', '-e', "import('@totemsdk/intelligence/training').then(m=>{if(typeof m.computeExampleRoot!=='function'||typeof m.sealTrainingExample!=='function')process.exit(1)})"],
    consumer,
  );

  console.log('TRAINING_PACK_OK');
} catch (error) {
  keep = true;
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  console.error(`artifacts kept at ${tmp}`);
  process.exitCode = 1;
} finally {
  if (!keep) rmSync(tmp, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = join(dirname(fileURLToPath(import.meta.url)), '..', 'verify-workspace.mjs');
const gates = {
  alpha: ['typecheck', 'lint', 'test'],
  beta: ['typecheck', 'lint', 'test', 'pack'],
  rc: ['typecheck', 'lint', 'test', 'pack', 'integration'],
  v1: ['typecheck', 'lint', 'test', 'pack', 'integration', 'conformance', 'recovery', 'consumer'],
};

function fixture(t, definitions, maturityGates = gates, { sharedLint } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'workspace-gate-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  copyFileSync(source, join(root, 'scripts', 'verify-workspace.mjs'));
  if (sharedLint && sharedLint !== 'missing') {
    writeFileSync(join(root, 'scripts', 'shared-lint.mjs'), `
      import { appendFileSync } from 'node:fs';
      import { basename } from 'node:path';
      appendFileSync(${JSON.stringify(join(root, 'invocations.log'))}, basename(process.argv[2]) + ':shared-lint\\n');
      process.exit(${sharedLint === 'fail' ? 1 : 0});
    `);
  }
  writeFileSync(join(root, 'scripts', 'verify-consumer-pack.mjs'), `
    import { appendFileSync } from 'node:fs';
    import { basename } from 'node:path';
    appendFileSync(${JSON.stringify(join(root, 'invocations.log'))}, basename(process.argv[2]) + ':packed-consumer\\n');
  `);
  const packages = {};
  for (const [name, definition] of Object.entries(definitions)) {
    const dir = `packages/${name}`;
    const full = join(root, dir);
    mkdirSync(join(full, 'src', '__tests__'), { recursive: true });
    writeFileSync(join(full, 'src', '__tests__', 'fixture.test.js'), '// fixture test marker\n');
    writeFileSync(join(full, 'gate-fixture.mjs'), `
      import { appendFileSync } from 'node:fs';
      appendFileSync(${JSON.stringify(join(root, 'invocations.log'))}, ${JSON.stringify(name)} + ':' + process.argv[2] + '\\n');
    `);
    const scripts = Object.fromEntries(['build', 'lint', 'test', 'test:integration', 'test:conformance', 'test:recovery', 'test:consumer'].map((gate) => [gate, `node gate-fixture.mjs ${gate}`]));
    Object.assign(scripts, definition.scripts);
    for (const gate of definition.missing ?? []) delete scripts[gate];
    writeFileSync(join(full, 'package.json'), JSON.stringify({
      name: `@fixture/${name}`, version: '1.0.0', files: ['src'], scripts,
      ...(definition.dependencies ? { dependencies: definition.dependencies } : {}),
    }));
    packages[dir] = { status: 'publishable', maturity: definition.maturity, notApplicable: definition.notApplicable };
  }
  writeFileSync(join(root, 'scripts', 'workspace-gates.config.json'), JSON.stringify({
    workspaceGlobs: ['packages/*'], packages, maturityGates,
    ...(sharedLint ? { lint: { sharedRunner: 'scripts/shared-lint.mjs' } } : {}),
  }));
  return {
    run(...args) {
      const result = spawnSync(process.execPath, [join(root, 'scripts', 'verify-workspace.mjs'), ...args], {
        cwd: root, encoding: 'utf8', timeout: 30_000,
        env: { ...process.env, SKIP_PREREQUISITE_BUILD: '0' },
      });
      assert.equal(result.error, undefined);
      return {
        ...result,
        commands: existsSync(join(root, 'invocations.log'))
          ? readFileSync(join(root, 'invocations.log'), 'utf8').trim().split('\n') : [],
      };
    },
  };
}

test('a maturity-only selector executes all required gates for exactly that maturity', (t) => {
  const result = fixture(t, { stable: { maturity: 'v1' }, experimental: { maturity: 'alpha' } }).run('--maturity', 'v1');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.commands, ['stable:build', 'stable:lint', 'stable:test', 'stable:test:integration',
    'stable:test:conformance', 'stable:test:recovery', 'stable:packed-consumer', 'stable:test:consumer']);
  assert.match(result.stdout, /packages\/stable: pack --dry-run/);
  assert.doesNotMatch(result.stdout, /packages\/experimental: (build|lint|test|pack)/);
});

test('an explicit gate runs only that gate without requiring unrelated scripts', (t) => {
  const result = fixture(t, { stable: { maturity: 'v1', missing: ['test:integration', 'test'] } }).run('--maturity', 'v1', '--lint');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.commands, ['stable:lint']);
});

test('selected prerequisite builds include workspace dependencies, not unrelated packages', (t) => {
  const result = fixture(t, {
    stable: { maturity: 'v1', dependencies: { '@fixture/base': '*' } },
    base: { maturity: 'alpha' }, unrelated: { maturity: 'alpha' },
  }).run('--maturity', 'v1', '--typecheck');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.commands, ['base:build', 'stable:build']);
});

test('missing required integration evidence fails', (t) => {
  const result = fixture(t, { stable: { maturity: 'v1', missing: ['test:integration'] } }).run('--maturity', 'v1', '--integration');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /missing required test:integration/);
  assert.match(result.stdout, /no selected gate commands executed/);
});

test('a selector matching no packages fails instead of reporting zero-check PASS', (t) => {
  const result = fixture(t, { experimental: { maturity: 'alpha' } }).run('--maturity', 'v1');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /no publishable packages selected/);
  assert.deepEqual(result.commands, []);
});

test('invalid, missing, inherited-property selectors and unknown flags are errors', (t) => {
  const workspace = fixture(t, { stable: { maturity: 'v1' } });
  for (const args of [
    ['--maturity'], ['--maturity', 'stable'], ['--maturity', '__proto__'],
    ['--maturity', 'toString'], ['--maturity', 'v1', '--maturity', 'alpha'], ['--typo'],
  ]) {
    const result = workspace.run(...args);
    assert.equal(result.status, 2, `${args}: ${result.stdout}${result.stderr}`);
    assert.deepEqual(result.commands, []);
  }
});

test('N/A requires an owner and reason, and is not a passing check', (t) => {
  const result = fixture(t, {
    stable: { maturity: 'v1', missing: ['test:integration'], notApplicable: {
      integration: { owner: 'runtime-team', reason: 'Reviewed fixture exemption' },
    } },
  }).run('--maturity', 'v1', '--lint', '--integration');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /1 N\/A/);
  assert.doesNotMatch(result.stdout, /missing required/);
});

test('truthy unowned exemptions do not suppress required evidence failures', (t) => {
  const result = fixture(t, {
    stable: { maturity: 'v1', missing: ['test:integration'], notApplicable: { integration: 'skip' } },
  }).run('--maturity', 'v1', '--integration');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /missing required/);
});

test('N/A-only and prerequisite-only invocations cannot pass', (t) => {
  const result = fixture(t, {
    stable: { maturity: 'v1', missing: ['test:integration'], notApplicable: {
      integration: { owner: 'runtime-team', reason: 'Reviewed fixture exemption' },
    } },
  }).run('--maturity', 'v1', '--integration');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /no selected gate commands executed/);
});

test('unknown required gate names fail closed', (t) => {
  const result = fixture(t, { stable: { maturity: 'v1' } }, {
    ...gates, v1: [...gates.v1, 'unimplemented'],
  }).run('--maturity', 'v1', '--lint');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /unsupported required gate/);
});

test('RC does not implicitly pass or execute v1-only qualification gates', (t) => {
  const result = fixture(t, { candidate: { maturity: 'rc', missing: ['test:conformance', 'test:recovery', 'test:consumer'] } })
    .run('--maturity', 'rc');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.commands, ['candidate:build', 'candidate:lint', 'candidate:test', 'candidate:test:integration']);
});

for (const gate of ['conformance', 'recovery', 'consumer']) {
  test(`v1 fails when required ${gate} evidence is absent`, (t) => {
    const result = fixture(t, { stable: { maturity: 'v1', missing: [`test:${gate}`] } })
      .run('--maturity', 'v1', `--${gate}`);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, new RegExp(`missing required test:${gate}`));
    assert.deepEqual(result.commands, []);
  });
}

test('mandatory shared lint runs even without a local lint script', (t) => {
  const result = fixture(t, { stable: { maturity: 'v1', missing: ['lint'] } }, gates, { sharedLint: 'pass' })
    .run('--maturity', 'v1', '--lint');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.commands, ['stable:shared-lint']);
});

test('a package lint script cannot replace or bypass failing shared lint', (t) => {
  const result = fixture(t, { stable: { maturity: 'v1' } }, gates, { sharedLint: 'fail' })
    .run('--maturity', 'v1', '--lint');
  assert.equal(result.status, 1);
  assert.deepEqual(result.commands, ['stable:shared-lint', 'stable:lint']);
});

test('a lint N/A cannot exempt a package from configured shared lint', (t) => {
  const result = fixture(t, { stable: { maturity: 'v1', missing: ['lint'], notApplicable: {
    lint: { owner: 'fixture-owner', reason: 'cannot skip shared rules' },
  } } }, gates, { sharedLint: 'fail' }).run('--maturity', 'v1', '--lint');
  assert.equal(result.status, 1);
  assert.deepEqual(result.commands, ['stable:shared-lint']);
});

test('a missing configured shared runner fails even if a package lint script succeeds', (t) => {
  const result = fixture(t, { stable: { maturity: 'v1' } }, gates, { sharedLint: 'missing' })
    .run('--maturity', 'v1', '--lint');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /configured shared lint runner unavailable/);
});

test('direct qualification invocations cannot bypass failure-suppression checks', (t) => {
  const result = fixture(t, { stable: { maturity: 'v1', scripts: {
    'test:recovery': 'node gate-fixture.mjs test:recovery || true',
  } } }).run('--maturity', 'v1', '--recovery');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /forbidden marker/);
});

# Workspace verification and qualification gates

The authoritative requirements are `scripts/workspace-gates.config.json`,
executed by `scripts/verify-workspace.mjs`. A maturity label is a requirement
selection, not proof that a package has passed its qualification.

## Selection and execution

```bash
node scripts/verify-workspace.mjs --lint
node scripts/verify-workspace.mjs --maturity v1 --lint
node scripts/verify-workspace.mjs --maturity v1 --integration --conformance --recovery --consumer
node scripts/verify-workspace.mjs --maturity rc
```

`--maturity` selects packages at that **exact** level. Without explicit gate
flags it activates all requirements for the selected level. Explicit gate flags
run that subset of requirements. Build prerequisites include selected packages'
workspace dependency closure. Invalid arguments, empty selections, missing
enabled requirements and invocations with no actual gate execution fail.
Hygiene, build prerequisites and N/A records do not count as test execution.

## Shared mandatory lint

Every publishable package inherits `eslint.config.mjs` through
`scripts/lint-workspace-package.mjs`. A local `lint` script adds checks; it never
replaces the shared runner. A lint N/A cannot bypass configured shared lint.

The runner selects authored JS/TS files, including package tests and scripts,
and checks every selected file. Generated output (`dist`, `build`, wasm-bindgen
`pkg*`, native `target`), dependencies and declaration files are excluded.
Native Rust/Go source remains covered by its separate compiler/clippy/vet/test
jobs. A package with no authored JS/TS or a config that ignores its selected
sources fails this runner instead of passing a zero-file check.

Correctness rules such as unsafe Promise executors, unreachable code, duplicate
keys, unsafe optional chaining and invalid comparisons are errors. The existing
unused-variable/prefer-const/style warnings remain advisory and are counted in
each report. Inline disable comments cannot suppress the shared rules.

## Distinct RC and v1 requirements

| Level | Required gates |
|---|---|
| Alpha | Typecheck/build, shared lint, unit tests |
| Beta | Alpha plus pack validation |
| RC | Beta plus integration |
| v1 | RC plus conformance, recovery and packed-consumer qualification |

The package-owned script contracts are:

| Gate | Script | Required evidence |
|---|---|---|
| Integration | `test:integration` | Real cross-component/binding behavior; state the runtime/profile exercised |
| Conformance | `test:conformance` | Protocol/reference vectors, malformed inputs and declared runtime/binding compatibility |
| Recovery | `test:recovery` | Failure, restart/reconnect, teardown and uncertain-outcome handling appropriate to that profile |
| Consumer | `test:consumer` | Public API calls and type usage in a clean packed consumer for the package's declared entry modes |

The consumer gate additionally runs shared `verify-consumer-pack.mjs`: real
tarball installation, root ESM/CJS loading and strict NodeNext `.mts`/`.cts`
type imports when declarations are advertised. Declaration checking is enabled;
broken declarations cannot be hidden by `skipLibCheck`. This shared probe does
not substitute for package-specific API calls, explicit/wildcard subpath
coverage, or a full locally packed sibling dependency closure.

Missing scripts fail; do not rename unrelated unit tests or add no-op scripts to
claim qualification. The verifier dispatches repository-owned scripts: reviewers
must inspect their assertions and retained evidence. A process exiting zero is
not by itself protocol or recovery proof. Failure suppression is checked even
when qualification is invoked directly without `--lint`.

A genuinely inapplicable package-owned gate requires a reviewed record:

```json
{
  "notApplicable": {
    "recovery": {
      "owner": "named-maintaining-team",
      "reason": "Specific reviewed reason this profile has no recoverable state"
    }
  }
}
```

Exemptions are reported as N/A, not passing evidence. An all-N/A invocation fails.
No blanket exemptions have been added to existing packages.

## CI and current boundary

Workspace CI runs shared lint and gate regression tests. Its dedicated
`v1-qualification` job invokes integration/conformance/recovery/consumer gates
for v1 packages. Repository administrators must separately require the relevant
status checks in branch protection; a workflow job does not configure protection.

Current v1 scope is deliberately limited to packages with runnable evidence:

- `@totemsdk/core` — WASM/TS parity, golden/vector suites, runtime integration
  and packed consumer.
- `@totemsdk/core-wasm` — web/node parity, worker runtime integration and packed
  consumer.
- Both declare a reviewed recovery N/A: they are stateless crypto libraries and
  the host owns process recovery.

The other 16 previously-labelled v1 packages are now **RC** until they have
dedicated conformance/recovery/integration evidence. Their support tiers and
semver versions are unchanged; this is a fail-closed maturity correction, not a
support-tier demotion. See
[RFC-074](rfc/RFC-074-EDGE-TRANSPORT-QUALIFICATION-AND-FAIL-CLOSED-GATES.md) for
remaining profile, recovery and promotion criteria.

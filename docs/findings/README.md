# Findings from the canary

Work items found by the Totem Edge Canary, written so an agent or engineer can
pick one up without re-deriving the investigation.

This directory is **generated** (except this file). The canary owns the source
of truth at `artifacts/canary/src/findings/registry.ts`; run:

```bash
cd artifacts/canary
pnpm run findings --sdk <path-to-this-checkout> --write <path-to-this-checkout>/docs/findings
```

## What is here

| File | Purpose |
|---|---|
| `INDEX.md` | generated table: id, severity, kind, status, packages |
| `findings.json` | same data, machine-readable |
| `agent/<id>.md` | one self-contained brief per finding |
| `README.md` | this protocol |

## Ids

- `CAN-###` — raised by a canary run or a canary check.
- `OMN-###` — raised by an external audit, transcribed with `origin`
  (audit name, audited commit) and a `verification` value: `code-confirmed`,
  `reported` or `disputed`. A disputed entry records the disagreement in
  `origin.note`; it is not silently dropped.
- An audit id that names an issue already tracked under a `CAN-###` carries
  `canonical` and is not counted twice by the gate. Follow the canonical row.

## Release gate

`scripts/verify-findings-gate.mjs` reads `findings.json` and blocks a publish
while an open finding at or above the threshold names the package:

```bash
node scripts/verify-findings-gate.mjs --report                       # summary (CI)
node scripts/verify-findings-gate.mjs --min-severity high \
  --packages @totemsdk/omnia-vtxo                                   # gate (release)
```

Workspace CI runs it in report mode. `publish-totemsdk.yml` runs it for the
package being released and fails the resolve job, so the publish job never
starts. Resolve a finding in the canary registry, regenerate this directory,
and the gate clears.

## How to take one

1. Pick a brief from `agent/`. Start with `critical`, then `high`.
2. Reproduce it **before** changing code. The brief has the exact command and
   the expected/actual divergence.
3. Fix it at the layer the brief names. If the brief says the cause is
   unclassified, classify it first and record the evidence.
4. Run every command under **Verification** and the acceptance checklist.
5. Open a PR whose description starts with the finding id (for example
   `CAN-001: ...`). One finding per PR where practical.
6. After the fix is published, the canary's registry entry moves to `fixed`
   with the fixing commit, and the canary pins rise to the patch version.

## Rules

- **Fix upstream.** A finding is an SDK (or harness) issue; do not paper over
  it in a consumer, in `omnia-host`, or in the canary.
- **Never weaken the check.** Adjusting an assertion to match observed
  behaviour converts a defect into a false pass. If the check itself is wrong,
  say so in the PR and explain what it should assert instead.
- **No exemptions without an owner.** A `notApplicable` gate entry needs an
  owner and a reason; "not implemented yet" is not a reason.
- **Do not edit generated files by hand.** `INDEX.md`, `findings.json` and
  `agent/*` are overwritten on the next run.
- **Report what you could not do.** If the finding does not reproduce, or the
  fix needs a decision (wire format, custody semantics), stop and record the
  question in the PR rather than guessing.

## Finding kinds

- `sdk-defect` — a package misbehaves; fix the package.
- `sdk-gap` — a package is missing a verification gate or contract; add it.
- `canary-coverage` — the canary does not exercise a package; add coverage.
- `environment-blocked` — the scenario needs real infrastructure; this is an
  operator task, not a code change. Do not convert it to a simulator.

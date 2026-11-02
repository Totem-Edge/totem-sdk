# Edge / Act release train plan (2026-11)

Status: prerelease. **No backward-compatibility shims.** The `industrial-*`
naming is retired; `act-*` is the governed actuation layer.

## Current state

- Branch: `rfc-074/edge-gates`.
- Publishable packages: 72.
- `@totemsdk/edge@1.5.1` is the only missing upstream dependency; it blocks
  every `edge-*` package and `act-core`.
- Four packages are not yet on npm: `act-core` (renamed), `edge-gnss`,
  `edge-ocpp`, `edge-mavlink`.
- `check-family-install.mjs` defers unpublished packages and reports them;
  `STRICT_FAMILY_INSTALL=1` fails until every publishable package is on npm.
- The concurrent session's Omnia and extension work is now committed and must
  not enter this train.
- Remaining concurrent work is the MCP fold-in: the `act-core` recipe/resource/
  template updates and the regenerated MCP symbol index/baseline. It depends on
  the `act-core` rename and the new edge packages, so it lands after them.

## Commit sequence

Each commit should build, lint and run its package tests. Stage only the listed
paths; use `git add -p` for mixed docs (`RFC-054/064/065`, audits) where the
concurrent session also edited.

| # | Commit | Scope |
|---|--------|-------|
| 1 | `chore(gates): install packed local closure, defer unpublished family install, scope dist-tag check` | `scripts/verify-consumer-pack.mjs`, `scripts/check-family-install.mjs`, `scripts/report-dist-tags.mjs`, `.github/workflows/publish-totemsdk.yml`, `docs/VERIFICATION_GATES.md` |
| 2 | `fix(edge-can): harden sidecar and add vcan integration/recovery` | `packages/edge-can/**`, `tests/unit/edge-can/**`, `tests/qualification/edge-can/**`, `packages/edge-can/sidecar.json`, CI vcan steps |
| 3 | `test(edge-can): add packed consumer and promote v1` | consumer test, `workspace-gates.config.json`, `SDK_MANIFEST.json`, maturity/README/RFC-074, v1 CI can-utils |
| 4 | `feat(edge-coap): RFC 7252 codec, sidecar and qualification gates` | `packages/edge-coap/**`, unit/conformance/integration/recovery/consumer tests, sidecar |
| 5 | `feat(edge-coap): CBOR payloads and RFC 7641 observations` | `cbor.ts`, observation code, bridge claims, tests |
| 6 | `feat(edge-coap): OSCORE boundary and RFC 8613 vectors` | `security.ts`, `oscore.ts`, security/vector tests |
| 7 | `feat(edge-coap): RFC 7959 blockwise and v1 promotion` | block options, blockwise gateway, tests, registry/maturity |
| 8 | `feat(edge-grpc): raw-byte TLS streaming and qualification` | `packages/edge-grpc/**` including Go, `testserver`, all qualification tests, CI job |
| 9 | `test(edge): RC simulator integration gates` | `edge-bacnet`, `edge-ble`, `edge-email`, `edge-matter`, `edge-nfc`, `edge-opcua`, `edge-ros2`, `edge-adapters`; tests, scripts, config, CI, docs |
| 10 | `feat(edge-gnss): add GNSS/NMEA connector` | `packages/edge-gnss/**`, tests, manifest/config/README/maturity, CI |
| 11 | `refactor(act-core)!: rename industrial-action to act-core` | staged rename, all imports/tests/docs/lock, RFC-024/025 `act-*` names |
| 12 | `feat(edge-ocpp): add OCPP-J wire connector` | `packages/edge-ocpp/**`, tests, manifest/config/README/maturity, CI |
| 13 | `feat(edge-mavlink): add MAVLink wire connector` | `packages/edge-mavlink/**`, tests, manifest/config/README/maturity, CI |
| 14 | `feat(mcp): expose act-core recipe and refresh package index` | `packages/mcp-server/**`, `scripts/mcp-symbols.ast.json`, `scripts/mcp-index-baseline.json` |
| 15 | `docs(release): record edge/act train and version plan` | this plan plus final RFC/maturity sync |
| 16 | `chore(release): bump changed package versions` | version bumps below, lockfile, manifest/maturity |

Commits 4–7 may be squashed to one `feat(edge-coap)` commit if hunk-splitting is
not worth it; the release result is identical.

### MCP fold-in (commit 14)

The concurrent MCP work is already in the tree and its unit tests pass (60/60):

- `packages/mcp-server/src/recipes.ts` — new `governed-industrial-action`
  recipe using `@totemsdk/act-core`;
- `resources.ts` and `template-catalog.ts` — act-core naming;
- `scripts/mcp-index-baseline.json` and `scripts/mcp-symbols.ast.json` —
  regenerated index.

It must land **after** commits 11–13 (`act-core`, `edge-ocpp`, `edge-mavlink`)
so the generated index contains the renamed and new packages. Regenerate, do not
hand-edit:

```bash
pnpm --filter @totemsdk/mcp-server build          # writes ignored data/sdk-index.json
node scripts/generate-mcp-symbol-index.mjs
node scripts/verify-mcp-index.mjs --update        # baseline + AST
pnpm --filter @totemsdk/mcp-server test
node scripts/verify-mcp-index.mjs
```

If each commit must pass CI individually, fold the regenerated index delta into
the commit that adds each new package; otherwise the branch tip stays green with
commit 14 before the release tag.

## Version plan

| Package | Current | New | Dist-tag |
|---------|---------|-----|----------|
| `edge` | 1.5.1 | **publish 1.5.1** | `next` (RC) |
| `edge-can` | 0.2.1 | 0.3.0 | `latest` (v1) |
| `edge-coap` | 0.2.1 | 0.3.0 | `latest` (v1) |
| `edge-grpc` | 0.2.1 | 0.3.0 | `next` (RC) |
| `edge-bacnet`, `edge-ble`, `edge-email`, `edge-matter`, `edge-opcua`, `edge-ros2` | 0.2.1 | 0.2.2 | `next` |
| `edge-adapters` | 0.3.1 | 0.3.2 | `next` |
| `edge-nfc` | 0.1.1 | 0.2.0 | `next` (alpha → RC) |
| `act-core` | 0.5.0 | 0.5.0 (new name) | `next` |
| `edge-gnss`, `edge-ocpp`, `edge-mavlink` | — | 0.1.0 | `next` |
| `mcp-server` | 0.5.0 | 0.5.1 | `next` (after the new packages) |
| `act-ocpp`, `act-mavlink` | — | 0.1.0 | `next` |

`edge-mqtt`, `edge-modbus` and `edge-lorawan` do not need a republish; their
dependency on `edge@^1.5.1` resolves once `edge@1.5.1` exists.

## Release train (dependency-conscious)

The release pipeline is tag-driven (`totemsdk/<slug>-v<version>`), then
`release-sequentially.mjs` waits for each publish workflow.

### Stage 0 — preflight

```bash
pnpm install --frozen-lockfile
node scripts/verify-workspace.mjs --typecheck
node scripts/verify-workspace.mjs --maturity v1
node scripts/check-upstream-published.mjs   # expected: only edge@1.5.1 missing
node scripts/check-family-install.mjs       # defers 4 unpublished packages
```

### Stage 1 — unblock the graph

1. Tag and publish **`@totemsdk/edge@1.5.1`** (`next`).
2. Wait for the publish workflow.
3. Re-run `check-upstream-published.mjs`; it must pass.

Nothing else can be released before this step.

**Done 2026-11-01.** Tag `totemsdk/edge-v1.5.1` at `945ac22b`, release published,
`next` → `1.5.1` (`latest` stays `1.4.0`). `check-upstream-published.mjs` now
passes with 254 published refs; family install defers only the four unpublished
packages. The workflow run (`41307462077`) published successfully but its final
step failed: `report-dist-tags.mjs --check` inspects all 72 packages from inside
a single-package publish job, and it read a cached packument for `edge`. Fixed
in commit 1 by adding `--package` scoping, `--prefer-online`, a bounded retry,
and idempotent re-publish. Global drift stays with `dist-tags.yml`; 16 rc
packages still lack a `next` tag (remediate with the `dist-tags.yml` workflow in
`apply` mode), but none of them block this train.

### Stage 2 — RC / new packages (`next`)

Publish, in any order relative to each other (all depend only on `edge`, except
`act-core`, whose other upstreams are already published):

- `edge-bacnet`, `edge-ble`, `edge-email`, `edge-grpc`, `edge-matter`,
  `edge-nfc`, `edge-opcua`, `edge-ros2`, `edge-adapters`
- `edge-gnss`, `edge-ocpp`, `edge-mavlink` (first publication: publish with
  `--tag next`, never `latest`)
- `act-core`
- `mcp-server` (after the packages above, so its bundled index includes them)

After `act-core` is live, deprecate the old package:

```bash
npm deprecate @totemsdk/industrial-action "Renamed to @totemsdk/act-core (prerelease, no alias)"
```

**Done 2026-11-02.** `act-core@0.5.0`, `edge-grpc@0.3.0`, `edge-nfc@0.2.0`,
`edge-adapters@0.3.2`, the RC patch connectors, `edge-gnss@0.1.0`,
`edge-ocpp@0.1.0`, `edge-mavlink@0.1.0` and `mcp-server@0.5.1` are on `next`.

Every published version (0.1.0 through 0.3.0) is **deprecated** with the message
above, using the existing token-backed `deprecate-totemsdk.yml` workflow. The
whole-package form still needs `npm login` locally or the workflow to accept a
range.

### Stage 3 — v1 packages (`latest`)

- `edge-can@0.3.0`
- `edge-coap@0.3.0`

`edge-mqtt@0.3.1`, `edge-modbus@0.2.2` and `edge-lorawan@0.2.3` were **also
published**: their v1 versions existed in the repo but had never reached npm.
The earlier assumption that they needed no republish was wrong — their `latest`
tag still pointed at 0.2.x.

**Done 2026-11-02.** All five are on `latest` at their v1 version.

### Release failures fixed during the train

Twelve releases created on 2026-10-29 were still waiting for `npm-production`
approval (`edge-v1.5.0`, mqtt 0.3.0, modbus/lorawan/can/coap 0.2.1, and the RC
patches). That is why the v1 packages were behind. They were cancelled as
superseded and the current versions released.

The first stage-2 pass exposed four CI-only defects, all fixed:

- `act-core` resolved `@swc/jest` from the package while the filtered publish
  install only provides root devDependencies; it now uses `ts-jest`.
- `edge-adapters` and `edge-lorawan` tests imported workspace packages that a
  filtered install does not hoist to the repo root; jest maps them explicitly
  and `setup-pnpm` links every workspace package into the root `node_modules`.
- `edge-adapters` never declared `@totemsdk/edge` or `@totemsdk/core` as peers
  although they are in its public types; the consumer pack probe now also packs
  optional peers, whose types the declarations reference.
- the MQTT broker matrix created its bind-mounted passwd file as root and then
  failed to `chmod` it (EPERM); the container now runs as the invoking user.

### Stage 4 — strict verification

```bash
STRICT_FAMILY_INSTALL=1 node scripts/check-family-install.mjs
node scripts/check-upstream-published.mjs
node scripts/verify-workspace.mjs --maturity v1 --integration --conformance --recovery --consumer
pnpm --filter @totemsdk/edge-gnss test:integration
pnpm --filter @totemsdk/edge-ocpp test:integration
pnpm --filter @totemsdk/edge-mavlink test:integration
```

**Done 2026-11-02.** Strict family install: 72 packages, no deferrals.
Upstream guard: 256 first-party refs resolve to published versions. Every
edge/act/MCP package's `latest` or `next` tag now points at the released
version (v1 -> `latest`, rc -> `next`). v1 packages still carry an older `next`
tag from before promotion; it is unused by the maturity model and left as-is.

### Stage 5 — governed profiles

`act-ocpp` (RFC-024) and `act-mavlink` (RFC-025) are implemented as real
governed profiles, not wire-only substitutes:

- **act-ocpp** — connector resources and safe states, power/energy/duration
  interlocks, six governed operations, canonical prepared commands, RFC-022
  accepted→confirmed session lifecycle with charger meter/transaction readback,
  meter evidence digests, capability negotiation and an OCPP error taxonomy.
- **act-mavlink** — mission envelope model/digest/validation (altitude,
  waypoints, geofence), vehicle resources and safe state, envelope-bound
  `startMission`, telemetry reconciliation for arrival, hold/RTL/land
  confirmation, an autopilot conformance harness and a MAVLink error taxonomy.

**Done 2026-11-02.** Both are published at `0.1.0` on `next` (tags
`totemsdk/act-ocpp-v0.1.0`, `totemsdk/act-mavlink-v0.1.0`) with green publish
runs, 12 + 11 unit tests, 4 + 5 simulator integration tests and packed-consumer
declaration checks. The remaining open items are vendor bindings
documented in RFC-024 §9 / RFC-025 §9 (a CSMS/charger stack and an
autopilot/SITL target), plus OCPP 2.1 bidirectional support; these are integration
decisions, not missing governed semantics.

## Risks and rules

- **Do not publish dependents before `edge@1.5.1`.** `check-upstream-published`
  is the guard.
- **First publication of new packages must use `--tag next`**; default `latest`
  would mark an RC wire connector as stable.
- **`act-core` is a breaking prerelease rename**, not an alias. Deprecate the old
  name; do not publish a shim.
- **Family install is intentionally deferred** until the four unpublished
  packages are live; strict mode is the post-release check, not a PR check.
- **Do not include the concurrent session's omnia/extension/RFC edits** in this
  train. Split mixed docs with `git add -p`.
- Regenerate `docs/maturity.md`, `SDK_MANIFEST.json` and `README` counts before
  each release tag; generated `TotemEdgeSDKDocs` are rebuilt separately.

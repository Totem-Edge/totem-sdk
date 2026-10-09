# RFC-014 Amendment A — Capability Manifest Truthfulness

**Status:** Draft — A0, A1, A2 landed; A3 (Axia mirror re-publish) next
**Created:** 2026-10-08
**Revised:** 2026-10-08 (A0/A1/A2 implemented)
**Amends:** RFC-014 (Wallet Connect Parity)
**Touches:** `@totemsdk/connect` (`wallet` subpath), `@totemsdk/omnia` (`relay` subpath), the extension + PWA wallet bootstraps
**Depends on:** RFC-014 §6.3/§6.5, RFC-034 (Omnia relay method parity), RFC-035 (Omnia peer coordination)

> Focused amendment, not a rewrite. RFC-014 defines the shared wallet runtime and
> one capability manifest sourced from *enabled ports*. This amendment corrects a
> specific defect in that model: **port presence is not capability**. A declared
> port whose implementation returns `UNSUPPORTED` for a method currently yields
> `supported` in the manifest. The manifest must describe what the wallet will
> actually do.

---

## A.1 Problem

`buildWalletCapabilityManifest` (RFC-014 §6.5) derives support from the
*existence* of a port:

```ts
// packages/connect/src/wallet.ts
export function isMethodSupported(descriptor, ctx): boolean {
  if (descriptor.disposition === 'unsupported') return false;
  if (descriptor.requires.every((key) => ctx[key] !== undefined)) return true;
  const alt = descriptor.orRequires;
  return !!alt && alt.length > 0 && alt.every((key) => ctx[key] !== undefined);
}
```

This is a **proxy** for capability, and it is wrong whenever a port implements a
method as an explicit refusal. The concrete case is Omnia: `createRelayOmniaClient`
always returns `UNSUPPORTED` for `getRoute`, `getSwapRate`, `createFactory`,
`openVirtualChannel`, `closeFactory`, `spliceIn`, `spliceOut`
(`packages/omnia/src/relay-client.ts`, `ADVANCED_UNSUPPORTED`). Yet wiring that
client as the `omnia` port makes the manifest report all 13 Omnia methods
`supported`.

The current conformance test hard-codes the false invariant:

```ts
// packages/connect/src/__tests__/wallet.test.ts
it('marks every method supported when all ports are configured', () => {
  const unsupported = Object.entries(manifest.methods).filter(([, s]) => s === 'unsupported');
  expect(unsupported).toEqual([]);
});
```

A green 47/47 dispatch test therefore proves only that *some* port exists — not
that any operation works. dApps read `totem_getCapabilities` and believe the
wallet can create factories and splice; it cannot.

This is not only an Omnia issue. Any port that returns `{ success: false,
errorCode: 'UNSUPPORTED' }` — e.g. the extension's `lease` port in hosted mode
(`extensions/totem-extension/src/background/index.ts`, `reserveKeyUse` returns
`UNSUPPORTED` when self-hosted key use is off) — is mis-reported as supported.

## A.2 Goals

1. The manifest answers “will this method work?” — not “is a port object present?”.
2. A port can declare, per method, that it does not implement it, and the
   manifest reflects that with a reason.
3. Keep the RFC-014 model (one source, structural ports, no wallet imports).
4. Make the conformance test assert **truthfulness** (supported ⇒ a call that
   does not return `UNSUPPORTED`), not port presence.
5. Preserve backward compatibility: a port with no declaration behaves as today.

## A.3 Non-goals

- Changing the connect protocol/method set.
- Dynamically probing ports over the network at manifest-build time.
- Making the manifest a liveness guarantee. “Supported” means “the wallet will
  attempt the operation”; it does not promise the peer, chain, or network
  succeeds. That distinction is retained from RFC-014 §6.4.

## A.4 Design — a per-port capability declaration

Add an optional, structural declaration to each port interface. It is a plain
function so it needs no dependency and is trivially implemented:

```ts
// packages/connect/src/wallet.ts
export type MethodSupport = 'supported' | 'unsupported';

export interface SupportProbe {
  /**
   * Report whether this port will actually attempt `method`.
   * Return `false` (or `{ supported: false, reason }`) when the port would
   * return UNSUPPORTED. Absent ⇒ assume supported (backward compatible).
   */
  supports?(method: string): boolean | { supported: boolean; reason?: string };
}
```

`OmniaClientPort`, `WalletSignerPort`, `StatechainClientPort`, `KissvmClientPort`,
`WotsLeasePort`, `ReceiptStorePort`, `PaymentRequestPort`, and `SelfHostedPort` all
extend `SupportProbe`.

The probe receives the **connect method name** (e.g. `totem_omniaCreateFactory`),
i.e. the same key the manifest uses. This keeps one namespace for the manifest,
the runtime dispatch, and the probe. It does **not** force a lower-level package
like `@totemsdk/omnia` to import `@totemsdk/connect`: the probe is a *wallet-side*
declaration authored by whoever assembles the context (the wallet bootstrap, which
already knows both surfaces), and `@totemsdk/omnia` exports its unsupported set as
plain **data** (`ADVANCED_UNSUPPORTED`) for that code to adapt.

```ts
// packages/omnia/src/relay-client.ts — exported data, no connect import
export const ADVANCED_UNSUPPORTED = new Set([
  'getRoute', 'getSwapRate', 'createFactory', 'openVirtualChannel',
  'closeFactory', 'spliceIn', 'spliceOut',
]);

// wallet bootstrap (imports both @totemsdk/connect and @totemsdk/omnia)
const omniaMethod = (connectMethod: string): string =>
  OMNIA_CLIENT_METHOD_BY_METHOD[connectMethod] ?? connectMethod;
const omnia = {
  ...createRelayOmniaClient(opts),
  supports: (connectMethod: string) => {
    const name = omniaMethod(connectMethod);
    if (!options.operations && MUTATING.has(name)) {
      return { supported: false, reason: `Omnia ${name} requires wallet signing material.` };
    }
    if (ADVANCED_UNSUPPORTED.has(name)) {
      return { supported: false, reason: `Omnia ${name} is not supported by the relay client.` };
    }
    return true;
  },
};
```

> A future refinement could have each port expose a neutral per-method capability
> key so no name translation is needed, but that is not required for A0.

## A.5 Manifest derivation

`isMethodSupported` keeps the existing presence check, then requires that **every
port in the satisfying requirement set affirms the method**. `requires` is an
all-of set (AND); `orRequires` is an alternative all-of set (the method is
supported if the `requires` set is satisfied, *or* the whole `orRequires` set is):

```ts
function portAffirms(key: WalletPortKey, method: string, ctx: WalletHandlerContext): { ok: boolean; reason?: string } {
  const port = ctx[key] as SupportProbe | undefined;
  if (!port?.supports) return { ok: true };            // no declaration ⇒ assume supported
  const verdict = port.supports(method);
  return typeof verdict === 'boolean' ? { ok: verdict } : { ok: verdict.supported, reason: verdict.reason };
}

function setAffirms(keys: readonly WalletPortKey[], method: string, ctx: WalletHandlerContext) {
  const failures: { key: WalletPortKey; reason?: string }[] = [];
  for (const key of keys) {
    if (ctx[key] === undefined) return undefined;       // port absent ⇒ set not satisfied
    const v = portAffirms(key, method, ctx);
    if (!v.ok) failures.push({ key, reason: v.reason });
  }
  return { ok: failures.length === 0, failures };
}

export function isMethodSupported(descriptor, ctx): boolean {
  if (descriptor.disposition === 'unsupported') return false;
  const primary = setAffirms(descriptor.requires, descriptor.method, ctx);
  if (primary?.ok) return true;
  const alt = descriptor.orRequires?.length ? setAffirms(descriptor.orRequires, descriptor.method, ctx) : undefined;
  return alt?.ok === true;
}
```

`buildWalletCapabilityManifest` records the first declining probe's reason when the
method is `unsupported`, so `reasons[method]` stays the single explanation surface
(RFC-014 §6.5):

```ts
function probeReason(descriptor, ctx): string | undefined {
  const sets = [descriptor.requires, descriptor.orRequires ?? []];
  for (const keys of sets) {
    const r = setAffirms(keys, descriptor.method, ctx);
    if (r && r.failures.length > 0) return r.failures[0].reason;
  }
  return undefined;
}
// ...
if (supported === 'unsupported') {
  reasons[descriptor.method] = probeReason(descriptor, ctx) ?? descriptor.reason
    ?? 'Required wallet port not configured.';
}
```

## A.5.1 Runtime dispatch must honour the probe too

Truthfulness is not only a manifest concern: `createWalletRuntime`'s `dispatch`
checks `isMethodSupported(descriptor, ctx)` before executing and returns
`unsupported(descriptor.reason ?? …)` when false
(`packages/connect/src/wallet.ts:674`). With the probe wired into
`isMethodSupported`, an unsupported method is refused **before** its handler runs,
with the probe's reason — so the manifest and the live dispatch agree, and a
handler that would have returned `UNSUPPORTED` anyway is never reached.

`buildWalletCapabilityManifest(ctx, overrides)` keeps working; overrides remain
the escape hatch for a wallet that wants to pin a disposition explicitly.

## A.6 The wallet is still the source of truth

Nothing here changes RFC-014 §6.5's ownership: the **wallet** builds the manifest
from its runtime context and Axia only mirrors it (RFC-0002 §4.2a). The amendment
only makes the wallet's own manifest honest. The `POST /public/wallet-capabilities`
mirror and the dApp `GET` are unchanged.

## A.7 Conformance test becomes a truthfulness test

Replace the “all supported” assertion with a call-through proof. For every
method the manifest marks `supported`, dispatching with a valid-enough params
object must not yield `errorCode === 'UNSUPPORTED'`; for every method marked
`unsupported`, the manifest must carry a `reason`.

```ts
for (const [method, verdict] of Object.entries(manifest.methods)) {
  const result = await runtime.provider.request({ method, params: sampleParams(method) });
  if (verdict === 'supported') {
    expect((result as { errorCode?: string }).errorCode).not.toBe('UNSUPPORTED');
  } else {
    expect(manifest.reasons?.[method]).toBeTruthy();
  }
}
```

This is the test that would have caught the Omnia over-report. It is deliberately
weaker than “the operation succeeds” (which needs peers/chain); it asserts only
that a `supported` claim is not contradicted by an immediate `UNSUPPORTED`.

## A.8 Phasing

- **A0 — landed.** `SupportProbe` interface + probe-aware `isMethodSupported` /
  `buildWalletCapabilityManifest` + reason propagation into runtime dispatch.
  Backward compatible (no probes ⇒ current behaviour). Covered by
  `packages/connect/src/__tests__/wallet.test.ts`.
- **A1 — landed.** `createRelayOmniaClient.supports` + exported `ADVANCED_UNSUPPORTED`
  / `MUTATION_METHODS` truth sets (both name namespaces). Covered by
  `packages/omnia/src/__tests__/relay-client.test.ts`.
- **A2 — landed.** The extension supplies a real `lease` probe (Axia mode ⇒
  `reserveWotsLease`/`releaseWotsLease` report `unsupported` with a reason), backed
  by a synchronous network-config cache (`peekWalletNetworkConfig` /
  `isSelfHostedLeaseActive`, seeded at startup) so the synchronously-built manifest
  is honest. The §A.7 truthfulness test replaces the “all supported” invariant:
  for every method, a `supported` claim must not be contradicted by an immediate
  `UNSUPPORTED`. (`selfHosted`/`totem_setChainProvider` is deliberately **not**
  probed — its hosted case genuinely works, and a per-method probe cannot capture
  param-level partial support.)
- **A3 — next.** Axia mirror re-publish on manifest change (depends on the RFC-015
  P2 publish path already landed).

## A.9 Risks

| Risk | Mitigation |
|---|---|
| A probe disagrees with the handler | §A.7 conformance test; probe and handler share one truth table (`ADVANCED_UNSUPPORTED`) |
| Probe adds latency to manifest build | Probes are synchronous local predicates; no I/O |
| Wallets forget to declare a probe | Default is “assume supported” (today's behaviour); the over-report returns, but never a false negative |

## A.10 References

- RFC-014 §6.3 (method disposition), §6.5 (capability manifest), §7 (conformance gate)
- RFC-0002 §4.2a (wallet-capabilities mirror), RFC-015 §5.1
- RFC-034 (Omnia relay method parity), RFC-035 (Omnia peer coordination)
- `packages/connect/src/wallet.ts`, `packages/connect/src/__tests__/wallet.test.ts`
- `packages/omnia/src/relay-client.ts`

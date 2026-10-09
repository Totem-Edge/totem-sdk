# @totemsdk/omnia-relay

**Wallet-side Omnia client.** Composes the browser-safe relay transport from
`@totemsdk/omnia/relay` with routing (`@totemsdk/omnia-router`) and the
single-party factory/splice halves (`@totemsdk/omnia-factory`,
`@totemsdk/omnia-splice`) into one object a wallet assigns as its `omnia` port.

It exists because `@totemsdk/omnia-factory` and `@totemsdk/omnia-splice`
**depend on** `@totemsdk/omnia`; composing them *inside* `omnia` would create a
package cycle. This package sits **above** them instead, so the dependency graph
stays acyclic:

```
@totemsdk/omnia-relay
  → @totemsdk/omnia            (relay transport + channel lifecycle)
  → @totemsdk/omnia-router     (routing + swap announcements)
  → @totemsdk/omnia-factory    (single-party factory creation)
  → @totemsdk/omnia-splice     (single-party splice proposers)
```

It is browser-safe: no Hyperswarm, no SQLite, no Node builtins. The native
Hyperswarm path stays in `@totemsdk/omnia` behind a dynamic import the relay path
never reaches.

## Install

```bash
npm install @totemsdk/omnia-relay
```

## Usage

```ts
import { createOmniaRelayClient } from '@totemsdk/omnia-relay';

const omnia = createOmniaRelayClient({
  relayUrl: 'wss://api.axia.to/api/relay/ws', // default
  localParticipant: { partyId: 'me', publicKeyDigest: 'ab…', addressIndex: 0 },
  signer,          // ChannelSigner
  leaseProvider,   // WotsLeaseProvider (RFC-013)
  chainProvider,   // ChainStateProvider
  routing,         // optional RoutingPort; defaults to the wallet's own channels
});

// Assign as the wallet's Omnia port:
configureExtensionWalletRuntime({ omnia });
```

### Method coverage

| Method | Status | Notes |
|---|---|---|
| `getChannels`, `openChannel`, `pay`, `settle`, `closeChannel` | served | base relay client |
| `getRoute`, `getSwapRate` | served | read-only, over `@totemsdk/omnia-router` |
| `createFactory` | served (single-party) | mines + broadcasts the funding TxPoW; **approval-gated** |
| `spliceIn`, `spliceOut` | served (proposer half) | quiesce + propose; the accept/finalize half is Phase B |
| `openVirtualChannel`, `closeFactory`, `payMultiHop` | explicit `UNSUPPORTED` | multi-party; pending the coordination protocol (RFC-035) |

`supports(method)` reports the truth per method (RFC-014 Amendment A) so the
wallet capability manifest reflects what the client will actually attempt.

### Routing topology

Routing needs a graph. By default the client derives edges from the channels it
knows; a host (a self-hosted relay sidecar) can inject a fuller topology via
`RoutingPort`:

```ts
const routing = {
  snapshot: () => allKnownEdges,      // ChannelGraphEdge[]
  swaps: () => allSwapAnnouncements,  // optional
};
```

## References

- RFC-034 — Omnia Relay Method Parity (Phase A)
- RFC-035 — Omnia Peer Coordination Protocol (Phase B)
- RFC-014 — Wallet Connect Parity; RFC-014 Amendment A (manifest truthfulness)
- `@totemsdk/omnia-host` — the Node-side counterpart that orchestrates the same
  packages.

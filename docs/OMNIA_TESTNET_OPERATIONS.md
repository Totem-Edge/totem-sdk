# Omnia testnet operations

This is the reproducible baseline for the 7-host testnet findings. Pin exact
versions; do not rely on `0.x` caret resolution or the `latest` tag.

```bash
npm install --save-exact \
  @totemsdk/omnia-host@0.13.1 \
  @totemsdk/omnia-relay@0.6.0 \
  @totemsdk/omnia-vtxo@0.8.1 \
  @totemsdk/minima-rpc@0.5.0 \
  @totemsdk/core@1.4.1 \
  @totemsdk/wots-lease@1.0.2
```

Verify the resolved tree with `npm ls --all` or a committed lockfile. Published
dist-tags are not a compatibility contract.

## Relay

```bash
OMNIA_RELAY_HOST=0.0.0.0 \
OMNIA_RELAY_PORT=9300 \
OMNIA_RELAY_TOKEN='<long-random-token>' \
omnia-relay
```

TLS is enabled when `OMNIA_RELAY_TLS_KEY` and `OMNIA_RELAY_TLS_CERT` are both
set. Clients append `?token=<token>` to the relay URL.

## Host connectivity

- Shared hub: `OMNIA_P2P_HUB_URL=ws://hub.example:9400`. The host advertises
  the URL and does not start a local hub.
- Relay: `OMNIA_RELAY=wss://relay.example:9300?token=...`.
- Native DHT: private addresses are not routable; use a relay or routable
  announce addresses. Do not treat a private bind as global discovery.
- Chain identity: `OMNIA_GENESIS_HASH=<hash>` fails startup on a mismatched
  chain. Without it, `OMNIA_NETWORK_ID` is observation metadata only.

## Funding

`totem_omniaGetFundingCoins` discovers coins through the chain provider and
returns any available proofs. A node may report only wallet-relevant coins, so
foreign WOTS addresses can legitimately return an empty set. Missing proofs are
reported as absent, never as a funding success.

## Observation

- `GET /healthz`, `GET /readyz`
- `GET /observe` and `GET /observe/snapshot`
- `GET /observe/events?after=<cursor>`

Observation is event-driven. A quiet host may render no node rows until a
snapshot heartbeat is emitted by the consumer. `/observe` is a convenience alias
for the snapshot; `/observe/events` remains the cursor stream.

## Routing

Hosts gossip `ROUTE_GRAPH_ANNOUNCE` over connected channel peers. Imported
edges are advisory, capped at two hops and never authorize a payment. Local
channels always win over imported edges with the same channel id.

## Close semantics

Off-chain close is not on-chain settlement. A peer can remain `active` after the
other side closes until settlement is observed. See the channel state machine
and settlement lifecycle for the authoritative transition rules.

## Automine

`automine` is a node/test-harness flag, not an Omnia SDK flag. The current
test recipe uses the side effect of `-genesis`; a separate `-automine` flag must
be added to the node harness if persistent chain data and automine are needed
together.

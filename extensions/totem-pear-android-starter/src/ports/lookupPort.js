/**
 * lookupPort.js — EdgeLookupPort backed by pureminima-rpc + polling.
 *
 * lookup()  → queries the node's coin/history index for an address or tokenId.
 * watch()   → polls the node every `pollIntervalMs` and fires onUpdate on changes.
 *
 * For true P2P lookup (DHT-based, serverless), pair this with @totemsdk/lookup-node
 * and replace the rpc calls with a LookupClient backed by BareHyperswarm from
 * @totemsdk/pear/network.
 *
 * EdgeLookupPort interface:
 *   lookup({ query, kind? }) → EdgeOperationResult<{ results: unknown[] }>
 *   watch({ address, onUpdate }) → EdgeOperationResult<{ unsubscribe: () => void }>
 */

const POLL_INTERVAL_MS = 5_000;

export function createLookupPort(rpc) {
  return {
    async lookup({ query, kind }) {
      try {
        const results = [];

        if (kind === 'token') {
          const token = await rpc.tokens(query);
          if (token) results.push(token);
        } else if (kind === 'history') {
          const history = await rpc.history({ address: query });
          results.push(...(history ?? []));
        } else {
          const coins = await rpc.coins({ address: query });
          results.push(...(coins ?? []));
        }

        return { ok: true, data: { results } };
      } catch (err) {
        return { ok: false, error: err.message ?? 'lookup failed' };
      }
    },

    async watch({ address, onUpdate }) {
      let lastSeen = null;

      const timer = setInterval(async () => {
        try {
          const coins = await rpc.coins({ address });
          const snapshot = JSON.stringify(coins);
          if (snapshot !== lastSeen) {
            lastSeen = snapshot;
            onUpdate(coins);
          }
        } catch {
          /* polling errors are non-fatal — next tick will retry */
        }
      }, POLL_INTERVAL_MS);

      return {
        ok: true,
        data: {
          unsubscribe: () => clearInterval(timer),
        },
      };
    },
  };
}

/**
 * app.js — Totem Edge Android Pear app entry point.
 *
 * Wiring order:
 *   1. Lifecycle  — createPearApp() registers Pear teardown + hot-reload hooks
 *   2. Config     — loadConfig() resolves Pear.config → Pear.storage → config.json
 *   3. Storage    — SeedStore wraps BareKVStore (Hyperbee) for seed persistence
 *   4. RPC        — createPureMinimaClient() for on-chain balance/send queries
 *   5. Ports      — EdgeLiquidityPort, EdgePaymentPort, EdgeLookupPort
 *   6. Omnia      — createChannelManager() for L2 payment channels over relay WS
 *   7. Runtime    — createEdgeRuntime() composes everything into one object
 *
 * Run locally:    node app.js
 * Run in Pear:    pear run --dev .
 */

import { createPearApp, loadConfig, createLogger } from '@totemsdk/pear';
import {
  createEdgeRuntime,
  createEdgeDevice,
  createCapabilitySet,
} from '@totemsdk/edge';
import { createPureMinimaClient } from '@totemsdk/pureminima-rpc';

import { SeedStore }        from './src/storage/seedStore.js';
import { createLiquidityPort } from './src/ports/liquidityPort.js';
import { createPaymentPort }   from './src/ports/paymentPort.js';
import { createLookupPort }    from './src/ports/lookupPort.js';
import { createChannelManager } from './src/omnia/channelManager.js';

async function main() {
  // ─── 1. Lifecycle ────────────────────────────────────────────────────────────
  const app = createPearApp({
    onUpdate: () => log.info('Pear hot-reload signal received'),
  });
  const log = createLogger('app');

  // ─── 2. Config ────────────────────────────────────────────────────────────────
  // Resolution order: Pear.config → Pear.storage → config.json → defaults
  const config = await loadConfig('totem-edge-android', './config.json');
  const nodeUrl    = config.minimaNodeUrl    ?? 'http://localhost:9005';
  const axiaApiKey = config.axiaApiKey       ?? '';
  const localPubkey = config.localPubkeyHex ?? '';

  log.info('Config loaded', { nodeUrl, relay: axiaApiKey ? 'hosted' : 'none' });

  // ─── 3. Storage ───────────────────────────────────────────────────────────────
  const seedStore = new SeedStore('./data/kv');
  app.onExit(() => seedStore.close());

  // Load or generate a seed for this device.
  // In production: derive localPubkey from this seed via @totemsdk/core.
  let seed = await seedStore.load();
  if (!seed) {
    // Bare / Node.js crypto for seed generation (32 random bytes)
    seed = new Uint8Array(32);
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(seed);
    } else {
      const { randomFillSync } = await import('node:crypto');
      randomFillSync(seed);
    }
    await seedStore.save(seed);
    log.info('New seed generated and stored');
  } else {
    log.info('Seed loaded from storage');
  }

  // ─── 4. RPC client ────────────────────────────────────────────────────────────
  // createPureMinimaClient is fetch-based — works in Bare/Pear with native fetch.
  // For Bare runtimes without fetch, use bareFetch from @totemsdk/pear/network.
  const rpc = createPureMinimaClient({ nodeUrl });

  // Quick connectivity check
  try {
    const status = await rpc.status();
    log.info('Node connected', { block: status.block, version: status.version });
  } catch {
    log.warn('Node not reachable at startup — will retry on first port call', { nodeUrl });
  }

  // ─── 5. Ports ─────────────────────────────────────────────────────────────────
  // Each port is a plain object implementing the EdgeXxxPort interface from
  // @totemsdk/edge. Inject only the ports your app actually needs — unused ports
  // can be omitted from EdgeRuntimePorts entirely.

  const liquidityPort = createLiquidityPort(rpc);
  const paymentPort   = createPaymentPort(rpc);
  const lookupPort    = createLookupPort(rpc);

  // ─── 6. Omnia L2 payment channels ────────────────────────────────────────────
  // createOmniaSwarm uses the Axia hosted relay (WebSocket) — works on Android
  // without a native Hyperswarm binary. Set axiaApiKey in config.json.
  //
  // The channelStore (Map<channelId, OmniaChannel>) is kept in memory. For
  // production, persist it via BareKVStore between restarts.

  let channelManager = null;

  if (axiaApiKey && localPubkey) {
    channelManager = await createChannelManager({
      axiaApiKey,
      localPubkey,
      // leaseProvider: ...  // provide a WotsLeaseProvider for automatic signState
      onChannelAccepted: (channel) => {
        log.info('Inbound channel accepted', { channelId: channel.channelId });
      },
      onStateUpdated: (channel) => {
        const [local, remote] = Object.entries(channel.balances ?? {});
        log.info('Channel state updated', {
          channelId: channel.channelId,
          seq: channel.currentSequence,
          balances: channel.balances,
        });
      },
      onSettlementProposed: (_payload) => {
        log.info('Settlement proposed — handle close/dispute here');
      },
    });
    app.onExit(() => channelManager.close());
    log.info('Omnia channel manager ready', { localPubkey });
  } else {
    log.warn('Omnia disabled — set axiaApiKey + localPubkeyHex in config.json to enable');
  }

  // ─── 7. Edge runtime ──────────────────────────────────────────────────────────
  const device = createEdgeDevice({
    kind: 'app',
    metadata: { platform: 'android-pear', nodeUrl },
  });

  const capabilities = createCapabilitySet([
    'payment:send',
    'chain:hosted-provider',
    'lookup:query',
    'lookup:watch',
    ...(channelManager ? ['payment:channel'] : []),
  ]);

  const runtime = createEdgeRuntime({
    deviceId: device.deviceId,
    capabilities,
    ports: {
      liquidity: liquidityPort,
      payment:   paymentPort,
      lookup:    lookupPort,
    },
  });

  log.info('Edge runtime ready', {
    deviceId: runtime.deviceId,
    version: runtime.version,
    capabilities: [...capabilities],
  });

  // ─── Example: check balance ───────────────────────────────────────────────────
  // Remove or replace this block with your app logic.
  const address = await rpc.getAddress().catch(() => null);
  if (address?.miniaddress) {
    runtime.assertCapability('chain:hosted-provider');
    const balance = await runtime.ports.liquidity.getBalance(address.miniaddress);
    if (balance.ok) {
      log.info('Balance', { confirmed: balance.data.balance, tokenId: balance.data.tokenId });
    }
  }

  // ─── Example: open an Omnia channel ──────────────────────────────────────────
  // Uncomment and fill in a real remote peer pubkey to open a payment channel.
  //
  // if (channelManager) {
  //   const { channel } = await channelManager.openChannelTo('REMOTE_PUBKEY_HEX', {
  //     channelId: globalThis.crypto.randomUUID(),
  //     localAddress:  'MxYOUR_ADDRESS...',
  //     remoteAddress: 'MxREMOTE_ADDRESS...',
  //     localBalance:  '10',
  //     remoteBalance: '0',
  //     tokenId: '0x00',
  //     localSigner: /* TreeKey signer from @totemsdk/core */,
  //   });
  //   log.info('Channel open', { channelId: channel.channelId });
  // }

  return { runtime, channelManager, seed };
}

main().catch((err) => {
  console.error('[app] Fatal startup error:', err);
  process.exit(1);
});

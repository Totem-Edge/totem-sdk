import path from 'node:path';
import { createOmniaHost, loadConfigFromEnv } from './index.js';
import { createPairingHttpServer, createPairingService } from './pairing.js';
import { createHostSigning, hasSigningMaterial } from './signing.js';
import { createHostIdentityAndManifest } from './identity.js';
import { createLocalSignerPort } from './signer-port.js';

async function runPair(): Promise<void> {
  const config = loadConfigFromEnv();
  const port = Number(process.env.OMNIA_PAIR_PORT ?? 7789);
  const host = process.env.OMNIA_PAIR_HOST ?? '127.0.0.1';
  const origins = (process.env.OMNIA_PAIR_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const capabilities = {
    chain: { rpcUrl: config.chainRpcUrl, network: 'minima' },
    lease: { modes: ['local', 'hybrid'] as Array<'local' | 'hybrid'> },
    ...(config.p2pHubPort
      ? {
          p2p: {
            hubUrl: `ws://${config.p2pHubHost ?? '127.0.0.1'}:${config.p2pHubPort}`,
            scopes: ['p2p.pubsub'] as ['p2p.pubsub'],
            ...(config.p2pHubTopics ? { topicPrefixes: config.p2pHubTopics } : {}),
          },
        }
      : {}),
  };
  const service = createPairingService({
    storePath: path.join(path.dirname(config.dbPath), 'pairing.json'),
    endpoint: `http://${host}:${port}`,
    network: 'minima',
    capabilities,
    ...(origins.length ? { allowedOrigins: origins } : {}),
  });
  const server = createPairingHttpServer(service, { host, port });
  const address = await server.listen();
  const invitation = service.createInvitation();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ...invitation, endpoint: `http://${address.host}:${address.port}` }, null, 2));
  } else {
    console.log('');
    console.log('Pair this node with your Totem extension');
    console.log('');
    console.log(`Node:        ${service.nodeId}`);
    console.log(`Network:     ${service.network}`);
    console.log(`Fingerprint: ${service.fingerprint}`);
    console.log(`Endpoint:    http://${address.host}:${address.port}`);
    console.log(`Expires:     ${new Date(invitation.expiresAt).toISOString()}`);
    console.log('');
    console.log(`Code: ${invitation.code}`);
    console.log('');
    console.log('Open Totem → Settings → Pair Node and paste the endpoint + code.');
  }
  await new Promise<void>((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
  await server.close();
}

async function main(): Promise<void> {
  if (process.argv[2] === 'pair') {
    await runPair();
    return;
  }
  const config = loadConfigFromEnv();
  const signing = config.readOnly || !hasSigningMaterial(config)
    ? undefined
    : createHostSigning(config);
  const identityAndManifest = signing
    ? await createHostIdentityAndManifest(config, signing)
    : undefined;
  const host = createOmniaHost(config, signing
    ? {
        signer: signing.signer,
        leaseProvider: signing.leaseProvider,
        signerPort: createLocalSignerPort(signing),
        transportKeyPair: signing.transportKeyPair,
        transportPubkey: signing.transportPubkey,
        identity: identityAndManifest?.identity
          ? {
              address: signing.address,
              publicKeyDigest: signing.publicKeyDigest,
              identityId: identityAndManifest.identity.document.id,
              delegation: identityAndManifest.identity.delegation,
            }
          : { address: signing.address, publicKeyDigest: signing.publicKeyDigest },
        manifest: identityAndManifest?.manifest,
      }
    : {});
  let closing = false;
  let resolveStopped!: () => void;
  const stopped = new Promise<void>((resolve) => {
    resolveStopped = resolve;
  });

  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    console.log(`[omnia-host] Received ${signal}; shutting down`);
    try {
      await host.close();
    } finally {
      resolveStopped();
    }
  };

  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

  await host.start();
  console.log(`[omnia-host] Starting on port ${host.config.port}`);
  await stopped;
}

main().catch((err: unknown) => {
  console.error('[omnia-host] Fatal startup error:', err);
  process.exitCode = 1;
});

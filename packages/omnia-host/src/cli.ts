import { createOmniaHost, loadConfigFromEnv } from './index.js';
import { createHostSigning, hasSigningMaterial } from './signing.js';
import { createHostIdentityAndManifest } from './identity.js';

async function main(): Promise<void> {
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

/**
 * Host identity + manifest layer (opt-in).
 *
 * - Service identity: an identity document derived from the host seed, plus an
 *   optional delegated identity claim loaded from OMNIA_HOST_IDENTITY_FILE
 *   (operator root → service delegate), validated via verifyIdentityClaim.
 * - Manifest: an EdgeServiceManifest signed at boot with the same signing path
 *   (signManifest). No periodic re-signing.
 *
 * Channels remain authenticated purely by WOTS signatures — identity is a
 * host-layer, opt-in concern and never touches @totemsdk/omnia.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  createIdentityDocument,
  verifyIdentityClaim,
  type SignedIdentityClaim,
  type TotemIdentityDocument,
} from '@totemsdk/identity';
import {
  signManifest,
  type EdgeServiceManifest,
  type EdgeServiceType,
  type SignedManifest,
} from '@totemsdk/manifest';
import type { OmniaHostConfig } from './config.js';
import type { HostSigning } from './signing.js';

export interface HostIdentity {
  document: TotemIdentityDocument;
  delegation?: SignedIdentityClaim;
}

export interface HostIdentityAndManifest {
  identity?: HostIdentity;
  manifest: SignedManifest<EdgeServiceManifest>;
}

function isEdgeServiceType(value: string): value is EdgeServiceType {
  return [
    'sensor',
    'robot',
    'mqtt-feed',
    'proof-index',
    'lookup-provider',
    'omnia-router',
    'calibration-authority',
    'verifier',
    'machine-service',
    'other',
  ].includes(value);
}

/** Load and validate the delegated identity claim file (if configured). */
export function loadHostIdentity(config: OmniaHostConfig, signing: HostSigning): HostIdentity | undefined {
  const document = createIdentityDocument({
    kind: 'service',
    rootAddress: signing.address,
    controllerAddress: signing.address,
    metadata: {
      serviceType: config.serviceType,
      publicKeyDigest: signing.publicKeyDigest,
    },
  });

  if (!config.identityFile) {
    return { document };
  }

  const identityPath = path.resolve(process.cwd(), config.identityFile);
  let raw: string;
  try {
    raw = fs.readFileSync(identityPath, 'utf8');
  } catch (error) {
    throw new Error(
      `OMNIA_HOST_IDENTITY_FILE could not be read at ${identityPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let delegation: SignedIdentityClaim;
  try {
    delegation = JSON.parse(raw) as SignedIdentityClaim;
  } catch {
    throw new Error(`OMNIA_HOST_IDENTITY_FILE at ${identityPath} is not valid JSON`);
  }
  const result = verifyIdentityClaim(delegation);
  if (!result.valid) {
    throw new Error(
      `OMNIA_HOST_IDENTITY_FILE delegation failed verification: ${result.reason ?? 'invalid claim'}`,
    );
  }
  if (delegation.claim.type !== 'delegates_to') {
    throw new Error('OMNIA_HOST_IDENTITY_FILE must contain a delegates_to claim');
  }
  if (delegation.claim.object !== signing.address) {
    throw new Error(
      `OMNIA_HOST_IDENTITY_FILE delegates to ${delegation.claim.object}, but the host address is ${signing.address}`,
    );
  }
  return { document, delegation };
}

/** Sign the boot-time EdgeServiceManifest with the host signing path. */
export async function createHostManifest(
  config: OmniaHostConfig,
  signing: HostSigning,
  identity?: HostIdentity,
): Promise<SignedManifest<EdgeServiceManifest>> {
  const serviceType = isEdgeServiceType(config.serviceType) ? config.serviceType : 'other';
  const manifest: EdgeServiceManifest = {
    type: 'edge-service',
    serviceId: `omnia-host:${signing.publicKeyDigest}`,
    name: 'omnia-host',
    version: '0.1.1',
    operatorAddress: identity?.delegation?.claim.issuer ?? signing.address,
    serviceType,
    description: 'Durable Omnia node daemon for channel lifecycle, routing, and control APIs',
    endpoints: [{ type: 'websocket', uri: `ws://${config.host}:${config.port}${config.wsPath}` }],
    capabilities: ['omnia:open-channel', 'omnia:update-channel', 'omnia:route', 'omnia:settle'],
    tags: ['omnia', 'payment-channel', 'daemon'],
  };
  return signManifest(manifest, signing.perAddressSeed, 0);
}

/** Boot-time identity + manifest assembly. */
export async function createHostIdentityAndManifest(
  config: OmniaHostConfig,
  signing: HostSigning,
): Promise<HostIdentityAndManifest> {
  const identity = loadHostIdentity(config, signing);
  const manifest = await createHostManifest(config, signing, identity);
  return { identity, manifest };
}

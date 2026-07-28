/**
 * @totemsdk/manifest — Manifest type definitions
 *
 * Four manifest categories for the MVP:
 *   AppManifest        — human-facing Pear app
 *   CapabilityManifest — ephemeral AI/agent service
 *   DAppManifest       — KISSVM contract / covenant
 *   EdgeServiceManifest — any persistent Totem Edge service
 *
 * No network, no blockchain, no Hyperswarm — pure schema.
 */

export type AppPermission =
  | 'wallet:read-balance'
  | 'wallet:request-payment'
  | 'omnia:open-channel'
  | 'omnia:update-channel'
  | 'lookup:watch-address'
  | 'kissvm:evaluate'
  | 'qvac:call-agent';

export interface AppManifest {
  type: 'app';
  appId: string;
  name: string;
  version: string;
  authorAddress: string;
  pearTopicKey: string;
  price: string;
  priceToken?: string;
  subscriptionInterval?: number;
  category: string[];
  permissions: AppPermission[];
  iconCid?: string;
  description: string;
  repoUrl?: string;
  minTotemVersion: string;
}

export interface CapabilityManifest {
  type: 'capability';
  capabilityId: string;
  capabilityName: string;
  agentAddress: string;
  agentIdentityKey: string;
  description: string;
  inputSchema: object;
  outputSchema: object;
  pricePerCall: string;
  priceToken?: string;
  paymentChannel?: 'omnia' | 'onchain';
  maxLatencyMs?: number;
  maxCallsPerMinute?: number;
  expiresAt: number;
  tags: string[];
}

export interface DAppAbiEntry {
  name: string;
  description: string;
  params: { name: string; type: string; description?: string }[];
}

export interface DAppManifest {
  type: 'dapp';
  dappId: string;
  name: string;
  version: string;
  authorAddress: string;
  contractHash: string;
  contractSource?: string;
  abi: DAppAbiEntry[];
  price: string;
  priceToken?: string;
  category: string[];
  description: string;
  auditReport?: string;
}

export type EdgeServiceType =
  | 'sensor'
  | 'robot'
  | 'mqtt-feed'
  | 'proof-index'
  | 'lookup-provider'
  | 'omnia-router'
  | 'calibration-authority'
  | 'verifier'
  | 'machine-service'
  | 'other';

export interface EdgeServiceManifest {
  type: 'edge-service';
  serviceId: string;
  name: string;
  version: string;
  operatorAddress: string;
  serviceType: EdgeServiceType;
  description: string;
  endpoints?: Array<{
    type: 'https' | 'mqtt' | 'hyperswarm' | 'websocket' | 'other';
    uri: string;
  }>;
  capabilities: string[];
  price?: string;
  priceToken?: string;
  paymentMethods?: Array<'omnia' | 'onchain' | 'invoice' | 'free'>;
  tags: string[];
  expiresAt?: number;
  minTotemVersion?: string;
}

export type Manifest =
  | AppManifest
  | CapabilityManifest
  | DAppManifest
  | EdgeServiceManifest;

/**
 * Wraps any manifest with a WOTS signature.
 *
 * `signerPublicKey` — hex of the full WOTS public key (required for
 * self-contained verification via verifyManifest).
 * `authorAddress`  — the Minima address of the signer, derived at sign time
 *   and stored for quick policy checks without re-deriving from the public key.
 */
export interface SignedManifest<T extends Manifest = Manifest> {
  manifest: T;
  authorAddress: string;
  signerPublicKey: string;
  signedAt: number;
  signature: string;
  rootIdentityProof?: string;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  signerAddress: string;
}

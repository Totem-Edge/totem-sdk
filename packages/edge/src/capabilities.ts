/**
 * Edge capability model.
 *
 * EdgeCapability strings follow a domain:action pattern.
 * edgeCapabilitiesFromTotemCapabilities maps @totemsdk/connect's TotemCapabilities
 * to an EdgeCapabilitySet without any runtime import of @totemsdk/connect.
 */

import type { TotemCapabilities } from '@totemsdk/connect';
import { EdgeCapabilityError } from './errors.js';

export type EdgeCapability =
  | 'wallet:self-custody'
  | 'wallet:wots-tree-key'
  | 'wallet:root-identity'
  | 'wallet:seed-export'
  | 'account:multi-address'
  | 'account:switcher'
  | 'chain:hosted-provider'
  | 'chain:pure-rpc'
  | 'chain:lookup-node'
  | 'chain:local-proof-verify'
  | 'chain:pear-runtime'
  | 'chain:hyperswarm'
  | 'txpow:local-mining'
  | 'txpow:progress-events'
  | 'omnia:channels'
  | 'omnia:routing'
  | 'omnia:multi-hop'
  | 'omnia:cross-token-swap'
  | 'omnia:factory'
  | 'omnia:virtual-channels'
  | 'omnia:splicing'
  | 'omnia:hyperswarm'
  | 'statechain:supported'
  | 'statechain:blind-se'
  | 'scripting:kissvm'
  | 'qvac:payment-intents'
  | 'qvac:explanations'
  | 'intelligence:llm'
  | 'intelligence:embed'
  | 'intelligence:rag'
  | 'intelligence:asr'
  | 'intelligence:translate'
  | 'intelligence:tts'
  | 'intelligence:diffusion'
  | 'intelligence:ocr'
  | 'intelligence:classify'
  | 'intelligence:audiogen'
  | 'intelligence:video'
  | 'intelligence:vla'
  | 'intelligence:world'
  | 'intelligence:models'
  | 'intelligence:system'
  | 'intelligence:plugins'
  | `intelligence:${string}`
  | 'decision:choice'
  | 'decision:score'
  | 'decision:probability'
  | 'decision:action'
  | 'proof:create'
  | 'proof:verify'
  | 'lookup:watch'
  | 'identity:resolve'
  | 'manifest:sign'
  | 'manifest:verify'
  | 'payment:send'
  | 'policy:check'
  | 'location:claim'
  | 'location:trail'
  | 'location:proof'
  | 'transport:stream'
  | 'transport:pubsub'
  | 'transport:websocket'
  | 'transport:hyperswarm'
  | 'transport:webrtc'
  | 'transport:stdio'
  | 'transport:modbus'
  | 'transport:grpc'
  | 'transport:coap'
  | 'transport:can'
  | 'transport:ble'
  | 'transport:lorawan'
  | 'transport:ros2'
  | 'transport:opcua'
  | 'transport:bacnet'
  | 'transport:matter'
  | 'industrial:action'
  | 'industrial:read';

export type EdgeCapabilitySet = Set<EdgeCapability>;

/**
 * All intelligence domain capability strings (intelligence:<domain>).
 * Used for discovery, gating, and documentation.
 */
export const EDGE_INTELLIGENCE_CAPABILITIES: readonly string[] = [
  'intelligence:llm',
  'intelligence:embed',
  'intelligence:rag',
  'intelligence:asr',
  'intelligence:translate',
  'intelligence:tts',
  'intelligence:diffusion',
  'intelligence:ocr',
  'intelligence:classify',
  'intelligence:audiogen',
  'intelligence:video',
  'intelligence:vla',
  'intelligence:world',
  'intelligence:models',
  'intelligence:system',
  'intelligence:plugins',
] as const;

/** Whether a capability string is an intelligence capability. */
export function isIntelligenceCapability(cap: string): boolean {
  return cap.startsWith('intelligence:');
}

/** True if every intelligence domain capability is present. */
export function hasIntelligenceCapability(
  set: EdgeCapabilitySet,
  domain: string,
): boolean {
  return set.has(`intelligence:${domain}` as EdgeCapability);
}

/**
 * The four closed decision capabilities (RFC-012 §4.2/§33.1). Decision is a
 * sibling of intelligence, with its own capability namespace — never
 * `intelligence:decision`.
 */
export const EDGE_DECISION_CAPABILITIES: readonly string[] = [
  'decision:choice',
  'decision:score',
  'decision:probability',
  'decision:action',
] as const;

/** Whether a capability string is a decision capability. */
export function isDecisionCapability(cap: string): boolean {
  return cap.startsWith('decision:');
}

/** True if a specific decision capability is granted. */
export function hasDecisionCapability(set: EdgeCapabilitySet, cap: string): boolean {
  return set.has(cap as EdgeCapability);
}

export function createCapabilitySet(caps: EdgeCapability[]): EdgeCapabilitySet {
  return new Set(caps);
}

export function hasCapability(set: EdgeCapabilitySet, cap: EdgeCapability): boolean {
  return set.has(cap);
}

export function assertCapability(set: EdgeCapabilitySet, cap: EdgeCapability): void {
  if (!set.has(cap)) {
    throw new EdgeCapabilityError(cap);
  }
}

/**
 * Maps boolean fields from @totemsdk/connect's TotemCapabilities to the
 * appropriate EdgeCapability strings.
 *
 * @totemsdk/connect is imported as a type-only import — no runtime import
 * is emitted, preserving independent deployability of @totemsdk/edge.
 */
export function edgeCapabilitiesFromTotemCapabilities(
  caps: TotemCapabilities,
): EdgeCapabilitySet {
  const result: EdgeCapability[] = [];

  const { wallet, account, chain, txpow, omnia, statechain, scripting, qvac } = caps;

  if (wallet.selfCustody) result.push('wallet:self-custody');
  if (wallet.wotsTreeKey) result.push('wallet:wots-tree-key');
  if (wallet.rootIdentity) result.push('wallet:root-identity');
  if (wallet.seedExport) result.push('wallet:seed-export');

  if (account.multiAddress) result.push('account:multi-address');
  if (account.accountSwitcher) result.push('account:switcher');

  if (chain.hostedProvider) result.push('chain:hosted-provider');
  if (chain.pureMinimaRpc) result.push('chain:pure-rpc');
  if (chain.lookupNode) result.push('chain:lookup-node');
  if (chain.localProofVerify) result.push('chain:local-proof-verify');
  if (chain.pearRuntime) result.push('chain:pear-runtime');
  if (chain.hyperswarm) result.push('chain:hyperswarm');

  if (txpow.localMining) result.push('txpow:local-mining');
  if (txpow.progressEvents) result.push('txpow:progress-events');

  if (omnia.channels) result.push('omnia:channels');
  if (omnia.routing) result.push('omnia:routing');
  if (omnia.multiHop) result.push('omnia:multi-hop');
  if (omnia.crossTokenSwap) result.push('omnia:cross-token-swap');
  if (omnia.factory) result.push('omnia:factory');
  if (omnia.virtualChannels) result.push('omnia:virtual-channels');
  if (omnia.splicing) result.push('omnia:splicing');
  if (omnia.hyperswarm) result.push('omnia:hyperswarm');

  if (statechain.supported) result.push('statechain:supported');
  if (statechain.blindSE) result.push('statechain:blind-se');

  if (scripting.kissvm) result.push('scripting:kissvm');

  if (qvac.paymentIntents) result.push('qvac:payment-intents');
  if (qvac.explanations) result.push('qvac:explanations');

  return createCapabilitySet(result);
}

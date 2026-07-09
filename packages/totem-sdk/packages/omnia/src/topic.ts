/**
 * Hyperswarm topic derivation for Omnia channels.
 *
 * All peers joining the same channel derive the same 32-byte topic key,
 * enabling rendezvous without a central directory.
 *
 * Wire format: SHA3-256('omnia:' + channelId)
 */

import { sha3_256 } from '@noble/hashes/sha3.js';

/**
 * Derive the 32-byte Hyperswarm topic Buffer for a given channel ID.
 */
export function channelTopic(channelId: string): Buffer {
  const input = new TextEncoder().encode('omnia:' + channelId);
  return Buffer.from(sha3_256(input));
}

/**
 * Derive a 32-byte Hyperswarm topic Buffer for peer-to-peer rendezvous.
 */
export function peerTopic(pubkey: string): Buffer {
  const input = new TextEncoder().encode('omnia:peer:' + pubkey);
  return Buffer.from(sha3_256(input));
}

/**
 * Derive a 32-byte Hyperswarm topic Buffer from an arbitrary topic string.
 * Used by `broadcast(topic, msg)`.
 */
export function broadcastTopic(topic: string): Buffer {
  return channelTopic(topic);
}

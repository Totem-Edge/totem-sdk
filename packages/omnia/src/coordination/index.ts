/**
 * Peer coordination transport (RFC-035 Phase B, B0).
 *
 * The relay never inspects message bodies, so coordination is a client-side
 * mini-protocol: durable proposals/acceptances plus verify-before-sign handlers.
 * This module provides the shared transport, store, and peer binding; the
 * factory/splice flows register their own handlers.
 */

import type { OmniaMessage, OmniaMessageType, OmniaPeer } from '../messaging-types.js';
import {
  isCoordinationKind,
  type CoordinationContext,
  type CoordinationHandler,
  type CoordinationHandlers,
  type CoordinationKind,
  type CoordinationPolicy,
  type CoordinationStore,
  type ProposalRecord,
} from './types.js';
import { createMemoryCoordinationStore } from './proposals.js';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface OmniaCoordinationConfig {
  /** Durable store; defaults to an in-memory store. */
  store?: CoordinationStore;
  policy?: CoordinationPolicy;
  handlers?: CoordinationHandlers;
}

export interface SendProposalParams {
  peer: OmniaPeer;
  kind: CoordinationKind;
  correlationId: string;
  channelId: string;
  payload: unknown;
  /** Pubkeys the proposal concerns (routing identity only). Defaults to `[peer.pubkey]`. */
  peers?: string[];
}

export interface OmniaCoordination {
  readonly store: CoordinationStore;
  readonly policy: Required<CoordinationPolicy>;
  /** Route a peer's inbound coordination messages to the registered handlers. */
  bindPeer(peer: OmniaPeer): () => void;
  /** Persist a proposal record and send the proposal message. */
  sendProposal(params: SendProposalParams): Promise<OmniaMessage>;
  /** Send a coordination message on a peer. */
  send(
    peer: OmniaPeer,
    type: OmniaMessageType,
    channelId: string,
    correlationId: string,
    payload: unknown,
  ): Promise<void>;
}

let nonceCounter = 0;
const nextNonce = (): number => ++nonceCounter;

export function createOmniaCoordination(config: OmniaCoordinationConfig = {}): OmniaCoordination {
  const store = config.store ?? createMemoryCoordinationStore();
  const policy: Required<CoordinationPolicy> = {
    autoAccept: config.policy?.autoAccept ?? false,
    ttlMs: config.policy?.ttlMs ?? DEFAULT_TTL_MS,
  };
  const handlers: CoordinationHandlers = config.handlers ?? {};

  const send = async (
    peer: OmniaPeer,
    type: OmniaMessageType,
    channelId: string,
    correlationId: string,
    payload: unknown,
  ): Promise<void> => {
    const message: OmniaMessage = { type, channelId, correlationId, nonce: nextNonce(), version: 1, payload };
    await peer.sendMessage(message);
  };

  const makeContext = (
    peer: OmniaPeer,
    message: OmniaMessage,
    correlationId: string,
  ): CoordinationContext => ({
    peer,
    from: peer.pubkey,
    message,
    correlationId,
    store,
    policy,
    send: (type, payload) => send(peer, type, message.channelId, correlationId, payload),
  });

  const bindPeer = (peer: OmniaPeer): (() => void) =>
    peer.onMessage((message: OmniaMessage) => {
      if (!isCoordinationKind(message.type) || !message.correlationId) return;
      const handler: CoordinationHandler | undefined = handlers[message.type as CoordinationKind];
      if (!handler) return;
      const correlationId = message.correlationId;
      handler(makeContext(peer, message, correlationId)).catch(() => {
        void send(peer, 'ERROR', message.channelId, correlationId, {
          error: `${message.type} handler failed`,
        }).catch(() => {});
      });
    });

  const sendProposal = async (params: SendProposalParams): Promise<OmniaMessage> => {
    const { peer, kind, correlationId, channelId, payload, peers } = params;
    const record: ProposalRecord = {
      correlationId,
      kind,
      channelId,
      payload,
      state: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + policy.ttlMs,
      peers: peers ?? [peer.pubkey],
    };
    await store.putProposal(record);
    const message: OmniaMessage = { type: kind, channelId, correlationId, nonce: nextNonce(), version: 1, payload };
    await peer.sendMessage(message);
    return message;
  };

  return { store, policy, bindPeer, sendProposal, send };
}

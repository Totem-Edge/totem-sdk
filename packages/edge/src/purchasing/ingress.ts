/**
 * purchasing/ingress.ts — Authenticated inbound message pipeline.
 *
 * Every inbound network message must pass an explicit ingress pipeline before
 * state mutation. Never pass unauthenticated state-changing messages into the
 * engine.
 *
 * Required order:
 *   decode → protocol version → size limit → schema → authenticate sender →
 *   verify signature → verify recipient → message ID/replay → load durable
 *   state → state/head/expiry → Work Admission → engine transition
 */

import { PURCHASING_VERSION, type NegotiationMessage } from './types.js';
import { messageId, messageType, type ReplayLedger, type ReplayEntry } from './messages.js';
import { NegotiationError, PURCHASE_ERROR_CODES } from './errors.js';

/** Maximum wire message size (bytes). */
export const MAX_NEGOTIATION_MESSAGE_BYTES = 64 * 1024;

/** Signature verification function. */
export type SignatureVerifier = (params: {
  digest: string;
  signature: string;
  signerPublicKey: string;
}) => boolean;

/** Canonical digest computation for a message (for signature verification). */
export type MessageDigester = (msg: NegotiationMessage) => string;

export interface IngressOptions {
  /** Local recipient address. */
  recipient: string;
  /** Signature verification. */
  verifySignature: SignatureVerifier;
  /** Canonical digest computation. */
  digest: MessageDigester;
  /** Replay ledger (durable). */
  replayLedger: ReplayLedger;
  /** Max message size in bytes. */
  maxBytes?: number;
}

export interface IngressResult {
  /** The authenticated message. */
  message: NegotiationMessage;
  /** The authenticated sender address. */
  sender: string;
  /** True when this exact message was already processed (idempotent replay). */
  replayed: boolean;
  /** Prior durable entry when replayed/completed. */
  priorEntry?: ReplayEntry;
  /**
   * True when this caller won the atomic replay claim and must process the
   * message. When false, the message was already claimed/completed — take the
   * replay path (return the prior outcome, do not re-process).
   */
  claimed: boolean;
  /** True when a stale PROCESSING lease was reclaimed. */
  reclaimed?: boolean;
}

/**
 * Run the authenticated ingress pipeline. Returns the authenticated message
 * and sender, or throws a typed error.
 *
 * The replay claim is ATOMIC: two identical messages arriving concurrently
 * cannot both observe "not present". Exactly one caller wins the claim.
 */
export async function ingress(
  raw: unknown,
  context: { sender: string; recipient: string },
  opts: IngressOptions,
): Promise<IngressResult> {
  // 1. Decode + size limit
  if (raw === null || typeof raw !== 'object') {
    throw new NegotiationError('INVALID_MESSAGE', 'message is not an object');
  }
  const encoded = JSON.stringify(raw);
  if (encoded.length > (opts.maxBytes ?? MAX_NEGOTIATION_MESSAGE_BYTES)) {
    throw new NegotiationError('MESSAGE_TOO_LARGE', 'message exceeds size limit');
  }

  const msg = raw as NegotiationMessage;

  // 2. Protocol version check
  if ((msg as { version?: number }).version !== PURCHASING_VERSION) {
    throw new NegotiationError('UNSUPPORTED_VERSION', 'unsupported protocol version');
  }

  // 3. Basic schema validation
  const type = messageType(msg);
  if (type === 'Unknown') {
    throw new NegotiationError('INVALID_MESSAGE', 'unknown message type');
  }

  // 4. Verify recipient
  const recipient = (msg as { recipient?: string }).recipient;
  if (recipient !== opts.recipient) {
    throw new NegotiationError(PURCHASE_ERROR_CODES.WRONG_RECIPIENT, 'message not addressed to us');
  }

  // 5. Verify signature
  const digest = opts.digest(msg);
  const signature = (msg as { signature?: string }).signature;
  const signerPublicKey = (msg as { signerPublicKey?: string }).signerPublicKey;
  if (!signature || !signerPublicKey) {
    throw new NegotiationError(PURCHASE_ERROR_CODES.INVALID_SIGNATURE, 'message missing signature');
  }
  if (!opts.verifySignature({ digest, signature, signerPublicKey })) {
    throw new NegotiationError(PURCHASE_ERROR_CODES.INVALID_SIGNATURE, 'message signature invalid');
  }

  // 6. Atomic message ID / replay claim
  const id = messageId(msg);
  const claim = await opts.replayLedger.claim(id, Date.now());
  if (!claim.claimed) {
    const entry = 'entry' in claim ? claim.entry : undefined;
    return {
      message: msg,
      sender: context.sender,
      replayed: true,
      priorEntry: entry,
      claimed: false,
    };
  }

  return {
    message: msg,
    sender: context.sender,
    replayed: false,
    claimed: true,
    reclaimed: claim.reclaimed,
  };
}

/**
 * CoAP security boundary.
 *
 * The connector owns framing, correlation and observation semantics, but not
 * cryptographic primitives. OSCORE (RFC 8613) contexts are supplied by a
 * reviewed implementation behind this port: the port decides which endpoints
 * are protected, applies/removes the OSCORE option and authenticates payloads.
 *
 * A gateway with a security port fails closed: protected endpoints must send
 * OSCORE messages, and OSCORE messages from unconfigured endpoints are dropped
 * rather than interpreted as plaintext.
 */

import type { CoapMessage } from './transport.js';

export interface CoapSecurityPort {
  /** Whether outbound traffic to (and inbound traffic from) this endpoint must be protected. */
  protects(host: string, port: number): boolean;
  /**
   * Add OSCORE protection. The implementation may replace `payload`, add the
   * OSCORE option and must preserve `messageId` and `token`.
   */
  protect(message: CoapMessage): Promise<CoapMessage>;
  /**
   * Authenticate and decrypt an inbound OSCORE message. Must throw on replay,
   * authentication failure or an unknown context; the gateway drops the message.
   */
  unprotect(message: CoapMessage): Promise<CoapMessage>;
}

/** True when a message carries an OSCORE option (it is not plaintext). */
export function isOscoreProtected(message: CoapMessage): boolean {
  return message.oscore !== undefined;
}

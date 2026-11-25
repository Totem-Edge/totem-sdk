import type {
  OmniaLspManifest,
  OmniaLspOpenQuote,
  OpenQuoteSignatureVerifier,
} from '@totemsdk/omnia-lsp';
import {
  validateOpenQuote,
  verifyOpenQuote,
  quoteMatchesManifest,
} from '@totemsdk/omnia-lsp';
import {
  evaluateOpenRequest,
  type OmniaLspOpenDecision,
  type OmniaLspOpenRequest,
  type OmniaLspProviderPolicy,
} from './policy.js';
import { addAmounts, gte } from './amounts.js';
import {
  createUnsignedOpenQuote,
  signOpenQuote,
  type UnsignedOmniaLspOpenQuote,
} from './quote.js';

/**
 * Optional funding inputs for a provider-hosted open.
 *
 * A provider that already selected its funding coin can pass the coin id plus
 * the node proof material. A provider that wants the host to select a coin can
 * omit all of these; `omnia-host` then selects a sendable coin and builds the
 * funding witness from its own wallet/node.
 */
export interface OmniaLspHostFunding {
  /** Address to select the provider funding coin from (simple wallet address). */
  fundingAddress?: string;
  fundingCoinId?: string;
  fundingPubkey?: string;
  fundingScript?: string;
  fundingCoinProofsHex?: string | string[];
  /** Provider-wallet-built witness. The consumer/dApp witness is still forbidden. */
  fundingWitnessHex?: string;
  /**
   * Channel contest delay. Omit for the host/program default (normally 256).
   * Test/dev hosts may pass a shorter value when OMNIA_ALLOW_SHORT_CONTEST_DELAY=1.
   */
  contestDelayBlocks?: number;
}

export interface OmniaLspHostOpenInput extends OmniaLspHostFunding {
  quote: OmniaLspOpenQuote;
}

export interface OmniaLspHostOpenResult {
  success: boolean;
  channelId?: string;
  fundingTxId?: string;
  error?: string;
  errorCode?: string;
}

export interface OmniaLspHostCloseResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Host port implemented by the provider runtime (for example an `omnia-host`
 * wrapper). The LSP package owns policy and quotes; the host owns channel
 * construction, signing and broadcast.
 */
export interface OmniaLspProviderHost {
  openChannel(input: OmniaLspHostOpenInput): Promise<OmniaLspHostOpenResult>;
  closeChannel?(channelId: string): Promise<OmniaLspHostCloseResult>;
}

/**
 * Single-use quote ledger.
 *
 * `openQuote()` must be atomic: two concurrent calls with the same signed quote
 * must not both reach the host. Production installs should supply a durable
 * implementation (SQLite/KV) so a restart does not reopen consumed quotes;
 * `createInMemoryQuoteConsumptionStore()` is the default and is only safe for a
 * single long-lived process.
 */
export interface OmniaLspQuoteConsumptionStore {
  /** Atomically consume. Returns false when the quote was already consumed. */
  consume(quoteId: string, expiresAt: number): Promise<boolean> | boolean;
  /** Drop expired entries. Optional; implementations may prune internally. */
  prune?(now: number): Promise<void> | void;
}

export function createInMemoryQuoteConsumptionStore(now: () => number = Date.now): OmniaLspQuoteConsumptionStore {
  const consumed = new Map<string, number>();
  return {
    consume(quoteId, expiresAt) {
      const at = now();
      for (const [id, expiry] of consumed) {
        if (expiry <= at) consumed.delete(id);
      }
      if (consumed.has(quoteId)) return false;
      consumed.set(quoteId, expiresAt);
      return true;
    },
    prune(at) {
      for (const [id, expiry] of consumed) {
        if (expiry <= at) consumed.delete(id);
      }
    },
  };
}

export interface OmniaLspOpenQuoteOptions {
  /**
   * Authenticated consumer the quote must belong to (address or party id). When
   * supplied, a quote issued to a different consumer is rejected — a stolen or
   * forwarded quote is otherwise indistinguishable from a legitimate one.
   */
  consumerAddress?: string;
  consumerPartyId?: string;
}

export interface OmniaLspProviderConfig {
  manifest: OmniaLspManifest;
  host: OmniaLspProviderHost;
  policy?: OmniaLspProviderPolicy;
  /** Provider identity signer for quotes. Required for quote issuance. */
  signQuote: (quote: UnsignedOmniaLspOpenQuote) => Promise<string> | string;
  /**
   * Verifier for the provider identity signature over
   * `openQuoteSigningPayload(quote)`. Required to accept an inbound quote;
   * without it `openQuote()` fails closed instead of trusting the signature
   * string.
   */
  verifyQuote?: OpenQuoteSignatureVerifier;
  /** Default quote TTL. Default 60s. */
  quoteTtlMs?: number;
  /** Clock injection for deterministic tests. */
  now?: () => number;
  /** Single-use quote ledger. Defaults to an in-memory store. */
  quoteConsumption?: OmniaLspQuoteConsumptionStore;
}

export interface OmniaLspProvider {
  manifest(): OmniaLspManifest;
  evaluate(request: OmniaLspOpenRequest): OmniaLspOpenDecision;
  quote(request: OmniaLspOpenRequest): Promise<OmniaLspOpenQuote>;
  open(
    request: OmniaLspOpenRequest,
    funding?: OmniaLspHostFunding | string,
  ): Promise<OmniaLspHostOpenResult>;
  openQuote(
    quote: OmniaLspOpenQuote,
    funding?: OmniaLspHostFunding | string,
    options?: OmniaLspOpenQuoteOptions,
  ): Promise<OmniaLspHostOpenResult>;
  close(channelId: string): Promise<OmniaLspHostCloseResult>;
}

function assertAllowed(decision: OmniaLspOpenDecision): void {
  if (!decision.allowed) {
    throw new Error(`Open request rejected: ${decision.errors.join('; ')}`);
  }
}

function fundingInput(funding?: OmniaLspHostFunding | string): OmniaLspHostFunding {
  return typeof funding === 'string' ? { fundingCoinId: funding } : funding ?? {};
}

/**
 * Reference provider facade.
 *
 * It does not hold keys, open channels or broadcast. It applies policy, issues
 * signed quotes and delegates the channel operation to the injected host.
 */
export function createOmniaLspProvider(config: OmniaLspProviderConfig): OmniaLspProvider {
  const now = config.now ?? Date.now;
  const quoteConsumption = config.quoteConsumption ?? createInMemoryQuoteConsumptionStore(now);

  /** Provider capital already promised by unexpired quotes, per token. */
  const reservations = new Map<string, { tokenId: string; amount: string; expiresAt: number }>();

  function pruneReservations(at: number): void {
    for (const [quoteId, reservation] of reservations) {
      if (reservation.expiresAt <= at) reservations.delete(quoteId);
    }
  }

  function reservedFor(tokenId: string, at: number): string {
    pruneReservations(at);
    let total = '0';
    for (const reservation of reservations.values()) {
      if (reservation.tokenId !== tokenId) continue;
      const next = addAmounts(total, reservation.amount);
      if (next === null) throw new Error('reservation amount is not a valid decimal');
      total = next;
    }
    return total;
  }

  /**
   * Reserve the provider's side of a quote so concurrent requests cannot
   * collectively exceed the advertised capital (OMN-066). Admission on its own
   * only proves that each request fits individually.
   */
  function reserve(quote: OmniaLspOpenQuote, at: number): { ok: true } | { ok: false; error: string } {
    const asset = config.manifest.assets.find((entry) => entry.tokenId === quote.tokenId);
    if (!asset) {
      return { ok: false, error: 'quote asset is not offered by the provider' };
    }
    // Conservative capital envelope: all outstanding provider commitments for a
    // token share the smaller of the two directional capacities.
    const ceiling = gte(asset.inboundCapacity, asset.outboundCapacity)
      ? asset.outboundCapacity
      : asset.inboundCapacity;
    const committed = addAmounts(reservedFor(quote.tokenId, at), quote.remoteAmount);
    if (committed === null) {
      return { ok: false, error: 'quote amount is not a valid decimal' };
    }
    if (!gte(ceiling, committed)) {
      return { ok: false, error: 'outstanding quotes already commit the provider capital for this asset' };
    }
    reservations.set(quote.quoteId, {
      tokenId: quote.tokenId,
      amount: quote.remoteAmount,
      expiresAt: quote.expiresAt,
    });
    return { ok: true };
  }

  async function issue(request: OmniaLspOpenRequest): Promise<OmniaLspOpenQuote> {
    const at = now();
    const decision = evaluateOpenRequest(config.manifest, request, {
      ...config.policy,
      now: () => at,
    });
    assertAllowed(decision);

    const unsigned = createUnsignedOpenQuote({
      manifest: config.manifest,
      request,
      now: at,
      ttlMs: config.quoteTtlMs,
    });
    const signed = await signOpenQuote(unsigned, config.signQuote);

    const reservation = reserve(signed, at);
    if (!reservation.ok) throw new Error(`Quote refused: ${reservation.error}`);
    return signed;
  }

  return {
    manifest() {
      return config.manifest;
    },

    evaluate(request) {
      return evaluateOpenRequest(config.manifest, request, config.policy);
    },

    quote: issue,

    async open(request, funding) {
      const issued = await issue(request);
      return config.host.openChannel({ quote: issued, ...fundingInput(funding) });
    },

    /**
     * Accept a quote produced earlier (possibly by another process).
     *
     * Everything that can make a signed quote untrustworthy is checked here, in
     * order, before the host is asked to commit provider capital:
     *
     *  1. expiry, against the provider's clock,
     *  2. structure and formats,
     *  3. the terms hash recomputed from the received fields (no edited terms),
     *  4. the provider's signature over the canonical payload,
     *  5. manifest binding and the consumer the quote was issued to,
     *  6. admission policy re-applied to the quoted terms,
     *  7. single-use consumption, then a capacity reservation.
     *
     * A failure at any step returns before the host is called. Consumption is
     * not released on host failure: the host may already have signed or
     * broadcast, so retrying the same quote could duplicate a channel.
     */
    async openQuote(quote, funding, options) {
      const at = now();
      if (quote.expiresAt <= at) {
        return { success: false, error: 'Quote expired', errorCode: 'QUOTE_EXPIRED' };
      }
      if (!config.verifyQuote) {
        return {
          success: false,
          error: 'Provider has no quote signature verifier configured',
          errorCode: 'QUOTE_VERIFICATION_UNAVAILABLE',
        };
      }

      const structural = validateOpenQuote(quote, {
        now: at,
        expectedProviderId: config.manifest.providerId,
      });
      if (!structural.ok) {
        return {
          success: false,
          error: `Invalid quote: ${structural.errors.join('; ')}`,
          errorCode: 'QUOTE_INVALID',
        };
      }

      const verified = await verifyOpenQuote(quote, config.verifyQuote, {
        now: at,
        expectedProviderId: config.manifest.providerId,
      });
      if (!verified.ok) {
        return {
          success: false,
          error: `Unverified quote: ${verified.errors.join('; ')}`,
          errorCode: 'QUOTE_UNVERIFIED',
        };
      }

      const binding = quoteMatchesManifest(quote, config.manifest);
      if (!binding.ok) {
        return {
          success: false,
          error: `Quote does not match the manifest: ${binding.errors.join('; ')}`,
          errorCode: 'QUOTE_MANIFEST_MISMATCH',
        };
      }

      if (options?.consumerAddress !== undefined && quote.consumerAddress !== options.consumerAddress) {
        return {
          success: false,
          error: 'Quote was issued to a different consumer',
          errorCode: 'QUOTE_CONSUMER_MISMATCH',
        };
      }
      if (options?.consumerPartyId !== undefined && quote.consumerPartyId !== options.consumerPartyId) {
        return {
          success: false,
          error: 'Quote was issued to a different consumer party',
          errorCode: 'QUOTE_CONSUMER_MISMATCH',
        };
      }

      // The quote does not carry the requested direction, so re-admission is
      // evaluated as 'both', which is the strictest capacity test.
      const decision = evaluateOpenRequest(config.manifest, {
        providerId: quote.providerId,
        consumerAddress: quote.consumerAddress,
        consumerPartyId: quote.consumerPartyId,
        consumerPublicKeyDigest: quote.consumerPublicKeyDigest,
        ...(quote.consumerSettlementAddress
          ? { consumerSettlementAddress: quote.consumerSettlementAddress }
          : {}),
        ...(quote.consumerTransportPubkey
          ? { consumerTransportPubkey: quote.consumerTransportPubkey }
          : {}),
        tokenId: quote.tokenId,
        localAmount: quote.localAmount,
        remoteAmount: quote.remoteAmount,
        direction: 'both',
        ...(quote.leaseFee !== undefined ? { lease: true } : {}),
      }, { ...config.policy, now: () => at });
      if (!decision.allowed) {
        return {
          success: false,
          error: `Quote no longer passes admission: ${decision.errors.join('; ')}`,
          errorCode: 'QUOTE_REJECTED',
        };
      }

      const consumed = await quoteConsumption.consume(quote.quoteId, quote.expiresAt);
      if (!consumed) {
        return {
          success: false,
          error: 'Quote has already been used',
          errorCode: 'QUOTE_ALREADY_USED',
        };
      }

      const reservation = reserve(quote, at);
      if (!reservation.ok) {
        return {
          success: false,
          error: reservation.error,
          errorCode: 'QUOTE_CAPACITY_EXHAUSTED',
        };
      }

      return config.host.openChannel({ quote, ...fundingInput(funding) });
    },

    async close(channelId) {
      if (!config.host.closeChannel) {
        return { success: false, error: 'Host does not implement closeChannel', errorCode: 'UNSUPPORTED' };
      }
      return config.host.closeChannel(channelId);
    },
  };
}

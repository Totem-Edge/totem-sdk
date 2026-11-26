import {
  parseDecimalUnits,
  verifyOpenQuote,
  type OmniaLspManifest,
  type OmniaLspOpenQuote,
  type OpenQuoteSigningPayload,
} from '@totemsdk/omnia-lsp';
import {
  evaluateOpenRequest,
  hasCapacity,
  type OmniaLspOpenDecision,
  type OmniaLspOpenRequest,
  type OmniaLspProviderPolicy,
} from './policy.js';
import {
  createUnsignedOpenQuote,
  signOpenQuote,
  type UnsignedOmniaLspOpenQuote,
} from './quote.js';
import { createMemoryQuoteLedger, type OmniaLspQuoteLedger } from './ledger.js';

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

/** The authenticated caller's identity, supplied by the API layer. */
export interface OmniaLspConsumerIdentity {
  address?: string;
  partyId?: string;
  publicKeyDigest?: string;
}

export interface OmniaLspProviderConfig {
  manifest: OmniaLspManifest;
  host: OmniaLspProviderHost;
  policy?: OmniaLspProviderPolicy;
  /** Provider identity signer for quotes. Required for quote issuance. */
  signQuote: (
    quote: UnsignedOmniaLspOpenQuote,
    payload: OpenQuoteSigningPayload,
  ) => Promise<string> | string;
  /**
   * Verify a provider quote signature over `domain|termsHash` (OMN-066).
   * Required to redeem a quote with `openQuote`; when absent, redemption fails
   * closed rather than trusting an unverified quote.
   */
  verifyQuoteSignature?: (
    input: OpenQuoteSigningPayload & { signature: string; quote: OmniaLspOpenQuote },
  ) => boolean | Promise<boolean>;
  /**
   * Durable reservation ledger (OMN-068). Defaults to an in-process ledger,
   * which enforces concurrency limits but does not survive a restart.
   */
  quoteLedger?: OmniaLspQuoteLedger;
  /**
   * Require `openQuote` to be given the authenticated consumer so the quote can
   * be bound to it. Default true — pass false only for a caller that has
   * already authenticated the quote's consumer outside this facade.
   */
  requireConsumerBinding?: boolean;
  /** Default quote TTL. Default 60s. */
  quoteTtlMs?: number;
  /** Clock injection for deterministic tests. The provider clock is authoritative. */
  now?: () => number;
}

export interface OmniaLspOpenQuoteOptions {
  /** Identity of the already-authenticated caller redeeming this quote. */
  consumer?: OmniaLspConsumerIdentity;
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

function reject(error: string, errorCode: string): OmniaLspHostOpenResult {
  return { success: false, error, errorCode };
}

function fundingInput(funding?: OmniaLspHostFunding | string): OmniaLspHostFunding {
  return typeof funding === 'string' ? { fundingCoinId: funding } : funding ?? {};
}

/**
 * Reference provider facade.
 *
 * It does not hold keys, open channels or broadcast. It applies policy, issues
 * signed quotes, reserves provider capacity and delegates the channel operation
 * to the injected host.
 */
export function createOmniaLspProvider(config: OmniaLspProviderConfig): OmniaLspProvider {
  const now = config.now ?? Date.now;
  const ledger = config.quoteLedger ?? createMemoryQuoteLedger();
  let quoteCounter = 0;

  /**
   * Re-apply admission to a quote that is being redeemed (OMN-066). The quote
   * does not carry `direction` or the lease flag, so this uses the conservative
   * `both` direction and derives lease from the quoted lease fee.
   */
  function quoteAsRequest(quote: OmniaLspOpenQuote): OmniaLspOpenRequest {
    return {
      providerId: quote.providerId,
      consumerAddress: quote.consumerAddress,
      consumerPartyId: quote.consumerPartyId,
      consumerPublicKeyDigest: quote.consumerPublicKeyDigest,
      ...(quote.consumerSettlementAddress !== undefined
        ? { consumerSettlementAddress: quote.consumerSettlementAddress }
        : {}),
      ...(quote.consumerTransportPubkey !== undefined
        ? { consumerTransportPubkey: quote.consumerTransportPubkey }
        : {}),
      tokenId: quote.tokenId,
      localAmount: quote.localAmount,
      remoteAmount: quote.remoteAmount,
      direction: 'both',
      ...(quote.leaseFee !== undefined ? { lease: true } : {}),
    };
  }

  async function quote(request: OmniaLspOpenRequest): Promise<OmniaLspOpenQuote> {
    const issuedAt = now();
    const decision = evaluateOpenRequest(config.manifest, request, config.policy, issuedAt);
    assertAllowed(decision);

    const unsigned = createUnsignedOpenQuote({
      manifest: config.manifest,
      request,
      now: issuedAt,
      ttlMs: config.quoteTtlMs,
      quoteId: `quote-${issuedAt.toString(36)}-${(++quoteCounter).toString(36)}`,
    });
    const signed = await signOpenQuote(unsigned, config.signQuote);

    const remote = parseDecimalUnits(signed.remoteAmount);
    if (!remote.ok) throw new Error(`cannot reserve provider capacity: ${remote.error}`);

    // Outstanding reservations count against the same capacity the manifest
    // advertises, so concurrent quotes cannot collectively exceed it (OMN-068).
    if (decision.asset) {
      const outstanding = await ledger.outstanding(
        signed.tokenId,
        config.manifest.providerId,
        issuedAt,
      );
      if (!hasCapacity(decision.asset, request.direction, outstanding + remote.units)) {
        throw new Error(
          'Open request rejected: provider capacity is exhausted by outstanding quotes',
        );
      }
    }

    await ledger.reserve({
      quoteId: signed.quoteId,
      providerId: config.manifest.providerId,
      tokenId: signed.tokenId,
      amount: signed.remoteAmount,
      amountUnits: remote.units,
      expiresAt: signed.expiresAt,
      state: 'reserved',
      updatedAt: issuedAt,
    });

    return signed;
  }

  async function redeem(
    quote: OmniaLspOpenQuote,
    funding?: OmniaLspHostFunding | string,
  ): Promise<OmniaLspHostOpenResult> {
    const consumed = await ledger.consume(quote.quoteId, now());
    if (consumed === 'unknown') {
      return reject(
        `Quote ${quote.quoteId} was not issued by this provider`,
        'QUOTE_NOT_ISSUED',
      );
    }
    if (consumed === 'expired') {
      return reject('Quote expired', 'QUOTE_EXPIRED');
    }
    if (consumed === 'already-consumed') {
      return reject(`Quote ${quote.quoteId} has already been used`, 'QUOTE_ALREADY_CONSUMED');
    }

    const result = await config.host.openChannel({
      quote,
      ...fundingInput(funding),
    });
    if (result?.success !== true) {
      // Nothing was funded, so the capacity goes back rather than being burned.
      await ledger.release(quote.quoteId, now());
    }
    return result;
  }

  return {
    manifest() {
      return config.manifest;
    },

    evaluate(request) {
      return evaluateOpenRequest(config.manifest, request, config.policy, now());
    },

    quote,

    async open(request, funding) {
      const issued = await quote(request);
      return redeem(issued, funding);
    },

    async openQuote(quote, funding, options) {
      const currentTime = now();
      if (quote.expiresAt <= currentTime) {
        return reject('Quote expired', 'QUOTE_EXPIRED');
      }
      if (quote.providerId !== config.manifest.providerId) {
        return reject('Quote provider mismatch', 'QUOTE_PROVIDER_MISMATCH');
      }

      // Bind the quote to the authenticated caller before anything else can act
      // on it. Without this the LSP authorization boundary is missing (OMN-066).
      const consumer = options?.consumer;
      const consumerBound = Boolean(
        consumer && (consumer.address || consumer.partyId || consumer.publicKeyDigest),
      );
      if (!consumerBound && config.requireConsumerBinding !== false) {
        return reject(
          'openQuote requires the authenticated consumer identity',
          'QUOTE_CONSUMER_UNBOUND',
        );
      }

      const verified = await verifyOpenQuote(quote, config.manifest, {
        now: currentTime,
        ...(config.verifyQuoteSignature
          ? { verifySignature: config.verifyQuoteSignature }
          : {}),
        ...(consumer?.partyId !== undefined
          ? { expectedConsumerPartyId: consumer.partyId }
          : {}),
        ...(consumer?.publicKeyDigest !== undefined
          ? { expectedConsumerPublicKeyDigest: consumer.publicKeyDigest }
          : {}),
        ...(consumer?.address !== undefined
          ? { expectedConsumerAddress: consumer.address }
          : {}),
      });
      if (!verified.ok) {
        return reject(
          `Quote rejected: ${verified.errors.join('; ')}`,
          'QUOTE_INVALID',
        );
      }

      // Re-apply the current policy: the manifest, custody mode and capacity may
      // have changed since the quote was issued.
      const policyDecision = evaluateOpenRequest(
        config.manifest,
        quoteAsRequest(quote),
        config.policy,
        currentTime,
      );
      if (!policyDecision.allowed) {
        return reject(
          `Quote no longer satisfies provider policy: ${policyDecision.errors.join('; ')}`,
          'QUOTE_POLICY_REJECTED',
        );
      }

      return redeem(quote, funding);
    },

    async close(channelId) {
      if (!config.host.closeChannel) {
        return reject('Host does not implement closeChannel', 'UNSUPPORTED');
      }
      return config.host.closeChannel(channelId);
    },
  };
}

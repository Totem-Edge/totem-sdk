import type { OmniaLspManifest, OmniaLspOpenQuote } from '@totemsdk/omnia-lsp';
import {
  evaluateOpenRequest,
  type OmniaLspOpenDecision,
  type OmniaLspOpenRequest,
  type OmniaLspProviderPolicy,
} from './policy.js';
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

export interface OmniaLspProviderConfig {
  manifest: OmniaLspManifest;
  host: OmniaLspProviderHost;
  policy?: OmniaLspProviderPolicy;
  /** Provider identity signer for quotes. Required for quote issuance. */
  signQuote: (quote: UnsignedOmniaLspOpenQuote) => Promise<string> | string;
  /** Default quote TTL. Default 60s. */
  quoteTtlMs?: number;
  /** Clock injection for deterministic tests. */
  now?: () => number;
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
  ): Promise<OmniaLspHostOpenResult>;
  close(channelId: string): Promise<OmniaLspHostCloseResult>;
}

function assertAllowed(decision: OmniaLspOpenDecision): void {
  if (!decision.allowed) {
    throw new Error(`Open request rejected: ${decision.errors.join('; ')}`);
  }
}

/**
 * Reference provider facade.
 *
 * It does not hold keys, open channels or broadcast. It applies policy, issues
 * signed quotes and delegates the channel operation to the injected host.
 */
export function createOmniaLspProvider(config: OmniaLspProviderConfig): OmniaLspProvider {
  const now = config.now ?? Date.now;

  async function quote(request: OmniaLspOpenRequest): Promise<OmniaLspOpenQuote> {
    const decision = evaluateOpenRequest(config.manifest, request, config.policy);
    assertAllowed(decision);

    const unsigned = createUnsignedOpenQuote({
      manifest: config.manifest,
      request,
      now: now(),
      ttlMs: config.quoteTtlMs,
    });
    return signOpenQuote(unsigned, config.signQuote);
  }

  return {
    manifest() {
      return config.manifest;
    },

    evaluate(request) {
      return evaluateOpenRequest(config.manifest, request, config.policy);
    },

    quote,

    async open(request, funding) {
      const issued = await quote(request);
      return config.host.openChannel({
        quote: issued,
        ...(typeof funding === 'string' ? { fundingCoinId: funding } : funding ?? {}),
      });
    },

    async openQuote(quote, funding) {
      if (quote.expiresAt <= now()) {
        return { success: false, error: 'Quote expired', errorCode: 'QUOTE_EXPIRED' };
      }
      if (quote.providerId !== config.manifest.providerId) {
        return { success: false, error: 'Quote provider mismatch', errorCode: 'QUOTE_PROVIDER_MISMATCH' };
      }
      return config.host.openChannel({
        quote,
        ...(typeof funding === 'string' ? { fundingCoinId: funding } : funding ?? {}),
      });
    },

    async close(channelId) {
      if (!config.host.closeChannel) {
        return { success: false, error: 'Host does not implement closeChannel', errorCode: 'UNSUPPORTED' };
      }
      return config.host.closeChannel(channelId);
    },
  };
}

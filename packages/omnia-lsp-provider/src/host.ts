import type {
  OmniaLspHostCloseResult,
  OmniaLspHostOpenInput,
  OmniaLspHostOpenResult,
  OmniaLspProviderHost,
} from './provider.js';

export type OmniaHostHandler = (params: unknown) => Promise<unknown> | unknown;

export interface OmniaHostMethodMap {
  get(name: string): OmniaHostHandler | undefined;
}

export interface CreateOmniaHostProviderHostOptions {
  /** `createHostMethods(context)` map (or any Map-like handler registry). */
  methods: OmniaHostMethodMap | Map<string, OmniaHostHandler>;
  openMethod?: string;
  closeMethod?: string;
  /** Optional operation id prefix. Default: omnia-lsp. */
  operationIdPrefix?: string;
}

function handlerFor(
  methods: OmniaHostMethodMap | Map<string, OmniaHostHandler>,
  name: string,
): OmniaHostHandler | undefined {
  return typeof (methods as OmniaHostMethodMap).get === 'function'
    ? (methods as OmniaHostMethodMap).get(name)
    : undefined;
}

interface HostOpenResponse {
  success?: boolean;
  channelId?: string;
  fundingTxId?: string;
  error?: string;
  errorCode?: string;
}

interface HostCloseResponse {
  success?: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Adapt an `omnia-host` method registry (`createHostMethods(context)`) to the
 * LSP provider host port.
 *
 * The quote is written from the consumer's perspective: `localAmount` is the
 * consumer side and `remoteAmount` is the provider side. The host is the provider,
 * so those sides are swapped when calling `totem_omniaOpenChannel`.
 */
export function createOmniaHostProviderHost(
  options: CreateOmniaHostProviderHostOptions,
): OmniaLspProviderHost {
  const openMethod = options.openMethod ?? 'totem_omniaOpenChannel';
  const closeMethod = options.closeMethod ?? 'totem_omniaCloseChannel';
  const prefix = options.operationIdPrefix ?? 'omnia-lsp';

  return {
    async openChannel({
      quote,
      fundingAddress,
      fundingCoinId,
      fundingPubkey,
      fundingScript,
      fundingCoinProofsHex,
      fundingWitnessHex,
      contestDelayBlocks,
    }: OmniaLspHostOpenInput): Promise<OmniaLspHostOpenResult> {
      const handler = handlerFor(options.methods, openMethod);
      if (!handler) {
        return {
          success: false,
          error: `${openMethod} is not registered on this omnia-host`,
          errorCode: 'UNSUPPORTED',
        };
      }

      try {
        const result = (await handler({
          remotePartyId: quote.consumerPartyId,
          remotePublicKeyDigest: quote.consumerPublicKeyDigest,
          ...(quote.consumerSettlementAddress
            ? { remoteSettlementAddress: quote.consumerSettlementAddress }
            : {}),
          ...(quote.consumerTransportPubkey
            ? { remoteTransportPubkey: quote.consumerTransportPubkey }
            : {}),
          localAmount: quote.remoteAmount,
          remoteAmount: quote.localAmount,
          tokenId: quote.tokenId,
          ...(fundingAddress ? { fundingAddress } : {}),
          ...(fundingCoinId ? { fundingCoinId } : {}),
          ...(fundingPubkey ? { fundingPubkey } : {}),
          ...(fundingScript ? { fundingScript } : {}),
          ...(fundingCoinProofsHex !== undefined ? { fundingCoinProofsHex } : {}),
          ...(fundingWitnessHex ? { fundingWitnessHex } : {}),
          ...(contestDelayBlocks !== undefined ? { contestDelayBlocks } : {}),
          operationId: `${prefix}-open-${quote.quoteId}`,
        })) as HostOpenResponse;

        // A missing or malformed response is not success. The previous
        // `result?.success !== false` treated `undefined`, `{}` and an
        // error-only object as a successfully opened channel (OMN-068), so an
        // adapter that silently returned nothing looked identical to a real
        // funded channel.
        const opened = result?.success === true
          && typeof result.channelId === 'string'
          && result.channelId.length > 0;
        if (!opened) {
          return {
            success: false,
            ...(result?.channelId ? { channelId: result.channelId } : {}),
            ...(result?.fundingTxId ? { fundingTxId: result.fundingTxId } : {}),
            error: result?.error ?? 'Host did not confirm a channel id',
            errorCode: result?.errorCode ?? 'HOST_OPEN_UNCONFIRMED',
          };
        }

        return {
          success: true,
          ...(result?.channelId ? { channelId: result.channelId } : {}),
          ...(result?.fundingTxId ? { fundingTxId: result.fundingTxId } : {}),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          errorCode: 'HOST_OPEN_FAILED',
        };
      }
    },

    async closeChannel(channelId: string): Promise<OmniaLspHostCloseResult> {
      const handler = handlerFor(options.methods, closeMethod);
      if (!handler) {
        return {
          success: false,
          error: `${closeMethod} is not registered on this omnia-host`,
          errorCode: 'UNSUPPORTED',
        };
      }

      try {
        const result = (await handler({
          channelId,
          operationId: `${prefix}-close-${channelId}`,
        })) as HostCloseResponse;
        if (result?.success !== true) {
          return {
            success: false,
            error: result?.error ?? 'Host did not confirm the close',
            errorCode: result?.errorCode ?? 'HOST_CLOSE_UNCONFIRMED',
          };
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          errorCode: 'HOST_CLOSE_FAILED',
        };
      }
    },
  };
}

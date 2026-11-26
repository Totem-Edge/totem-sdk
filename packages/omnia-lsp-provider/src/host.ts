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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
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

        // OMN-070: require explicit, operation-specific evidence. An undefined,
        // non-object, `{}` or error-only response is a failure, and success
        // without a channelId is not a successful open.
        if (!isRecord(result)) {
          return {
            success: false,
            error: `${openMethod} returned no structured result`,
            errorCode: 'HOST_PROTOCOL_ERROR',
          };
        }
        const channelId = text(result.channelId);
        if (result.success !== true) {
          return {
            success: false,
            error: text(result.error) ?? `${openMethod} reported failure`,
            errorCode: text(result.errorCode) ?? 'HOST_OPEN_FAILED',
          };
        }
        if (!channelId) {
          return {
            success: false,
            error: `${openMethod} reported success without a channelId`,
            errorCode: 'HOST_PROTOCOL_ERROR',
          };
        }
        return {
          success: true,
          channelId,
          ...(text(result.fundingTxId) ? { fundingTxId: text(result.fundingTxId)! } : {}),
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
        // OMN-070: an undefined or malformed close response is not a success.
        if (!isRecord(result) || result.success !== true) {
          return {
            success: false,
            error: isRecord(result) && text(result.error)
              ? text(result.error)!
              : `${closeMethod} did not confirm the close`,
            errorCode: isRecord(result) && text(result.errorCode)
              ? text(result.errorCode)!
              : 'HOST_CLOSE_FAILED',
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

import type {
  OmniaLspAsset,
  OmniaLspDirection,
  OmniaLspManifest,
} from '@totemsdk/omnia-lsp';

export interface OmniaLspOpenRequest {
  providerId: string;
  consumerAddress: string;
  /** Consumer Omnia party id (identity id or channel party id). */
  consumerPartyId: string;
  /** Consumer channel key digest (32-byte hex). */
  consumerPublicKeyDigest: string;
  consumerSettlementAddress?: string;
  consumerTransportPubkey?: string;
  tokenId: string;
  /** Consumer side of the initial channel balance, decimal units. */
  localAmount: string;
  /** Provider side of the initial channel balance, decimal units. */
  remoteAmount: string;
  direction: OmniaLspDirection;
  lease?: boolean;
  jit?: boolean;
  maxOpenFeeBps?: number;
  now?: number;
}

export interface OmniaLspOpenDecision {
  allowed: boolean;
  errors: string[];
  asset?: OmniaLspAsset;
}

export interface OmniaLspProviderPolicy {
  /** Reject hosted-custody manifests. Default true for a non-custodial LSP. */
  requireNonCustodial?: boolean;
  /** Minimum provider-bond score accepted by this provider. Informational only. */
  minProviderScore?: number;
}

const DECIMAL_SCALE = 18n;
const DECIMAL_FACTOR = 10n ** DECIMAL_SCALE;

function decimalKey(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return (
    BigInt(whole) * DECIMAL_FACTOR +
    BigInt(fraction.padEnd(Number(DECIMAL_SCALE), '0').slice(0, Number(DECIMAL_SCALE)))
  );
}

function gte(a: string, b: string): boolean {
  return decimalKey(a) >= decimalKey(b);
}

function hasCapacity(asset: OmniaLspAsset, direction: OmniaLspDirection, amount: string): boolean {
  if (direction === 'send') return gte(asset.outboundCapacity, amount);
  if (direction === 'receive') return gte(asset.inboundCapacity, amount);
  return gte(asset.inboundCapacity, amount) && gte(asset.outboundCapacity, amount);
}

/**
 * Evaluate an open request against a provider manifest.
 *
 * This is the provider's admission policy. It does not reserve capacity; the
 * provider MUST re-check capacity and channel state before co-signing.
 */
export function evaluateOpenRequest(
  manifest: OmniaLspManifest,
  request: OmniaLspOpenRequest,
  policy: OmniaLspProviderPolicy = {},
): OmniaLspOpenDecision {
  const errors: string[] = [];
  const now = request.now ?? Date.now();

  if (request.providerId !== manifest.providerId) {
    errors.push('request.providerId does not match the manifest');
  }
  if (manifest.expiresAt <= now) {
    errors.push('manifest is expired');
  }
  if (policy.requireNonCustodial !== false && (manifest.custody.mode === 'hosted' || manifest.custody.canMoveFunds)) {
    errors.push('hosted custody is not accepted by this provider policy');
  }

  const asset = manifest.assets.find((entry) => entry.tokenId === request.tokenId);
  if (!asset) {
    errors.push('asset is not offered by the provider');
  } else {
    if (!gte(request.localAmount, asset.minChannel)) {
      errors.push('localAmount is below the provider minimum');
    }
    if (!gte(asset.maxChannel, request.localAmount)) {
      errors.push('localAmount is above the provider maximum');
    }
    if (!hasCapacity(asset, request.direction, request.localAmount)) {
      errors.push('insufficient capacity for the requested direction');
    }
  }

  if (request.lease === true && manifest.terms.lease !== true) {
    errors.push('lease is not offered by the provider');
  }
  if (request.jit === true && manifest.terms.jit !== true) {
    errors.push('JIT is not offered by the provider');
  }
  if (
    request.maxOpenFeeBps !== undefined &&
    (manifest.fees.openBps ?? 0) > request.maxOpenFeeBps
  ) {
    errors.push('provider open fee exceeds the request maximum');
  }

  return { allowed: errors.length === 0, errors, ...(asset ? { asset } : {}) };
}

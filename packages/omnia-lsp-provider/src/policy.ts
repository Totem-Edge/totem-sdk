import type {
  OmniaLspAsset,
  OmniaLspDirection,
  OmniaLspManifest,
} from '@totemsdk/omnia-lsp';
import { addAmounts, applyBps, effectiveBps, gte, parseDecimalAmount } from './amounts.js';

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
  /**
   * Caller-supplied clock. IGNORED unless the policy opts in with
   * `allowRequestClock` (tests only). A caller must never be able to move the
   * provider's freshness window (OMN-067).
   */
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
  /**
   * Trusted clock. Defaults to `Date.now`. Provider runtimes should inject the
   * clock they also use for quote expiry so admission and issuance agree.
   */
  now?: () => number;
  /** Test-only escape hatch that lets `request.now` override the trusted clock. */
  allowRequestClock?: boolean;
  /**
   * Provider capital actually available for a token (decimal units). Manifests
   * advertise capacity; this is the operator's current committed liquidity. When
   * supplied, the provider's own contribution is checked against it (OMN-065).
   */
  availableProviderLiquidity?: (tokenId: string) => string | undefined;
}

/**
 * Directional capacity for an opening with two contributions.
 *
 * A channel consumes capacity on both sides at once, so each side needs its own
 * headroom. The provider's side is `remoteAmount`, the consumer's `localAmount`;
 * `direction` is the consumer's intended payment direction, matching
 * `capacityFor()` in `ranking.ts` ('send' → outbound, 'receive' → inbound).
 */
function hasTwoSidedCapacity(
  asset: OmniaLspAsset,
  direction: OmniaLspDirection,
  localAmount: string,
  remoteAmount: string,
  totalAmount: string,
): boolean {
  if (direction === 'send') {
    return gte(asset.outboundCapacity, localAmount) && gte(asset.inboundCapacity, remoteAmount);
  }
  if (direction === 'receive') {
    return gte(asset.inboundCapacity, localAmount) && gte(asset.outboundCapacity, remoteAmount);
  }
  return gte(asset.inboundCapacity, totalAmount) && gte(asset.outboundCapacity, totalAmount);
}

/**
 * Evaluate an open request against a provider manifest.
 *
 * This is the provider's admission policy. It validates BOTH sides of the
 * proposed channel — the consumer's `localAmount` and the provider's own
 * `remoteAmount` — against minimum/maximum channel size, total capacity and (when
 * configured) the provider's available liquidity. Validating only the consumer
 * side let a request commit the provider to arbitrary capital while still
 * passing every advertised limit (OMN-065).
 *
 * It still does not reserve capacity; the provider re-checks and reserves when
 * it issues a quote.
 */
export function evaluateOpenRequest(
  manifest: OmniaLspManifest,
  request: OmniaLspOpenRequest,
  policy: OmniaLspProviderPolicy = {},
): OmniaLspOpenDecision {
  const errors: string[] = [];
  const now = policy.allowRequestClock
    ? request.now ?? policy.now?.() ?? Date.now()
    : policy.now?.() ?? Date.now();

  if (request.providerId !== manifest.providerId) {
    errors.push('request.providerId does not match the manifest');
  }
  if (manifest.expiresAt <= now) {
    errors.push('manifest is expired');
  }
  if (policy.requireNonCustodial !== false && (manifest.custody.mode === 'hosted' || manifest.custody.canMoveFunds)) {
    errors.push('hosted custody is not accepted by this provider policy');
  }

  const localAtoms = parseDecimalAmount(request.localAmount);
  const remoteAtoms = parseDecimalAmount(request.remoteAmount);
  if (localAtoms === null) {
    errors.push('localAmount must be a non-negative decimal with at most 18 decimals');
  } else if (localAtoms === 0n) {
    errors.push('localAmount must be greater than zero');
  }
  if (remoteAtoms === null) {
    errors.push('remoteAmount must be a non-negative decimal with at most 18 decimals');
  }

  const asset = manifest.assets.find((entry) => entry.tokenId === request.tokenId);
  if (!asset) {
    errors.push('asset is not offered by the provider');
  } else if (localAtoms !== null && remoteAtoms !== null) {
    const totalAmount = addAmounts(request.localAmount, request.remoteAmount);
    if (totalAmount === null) {
      errors.push('channel total could not be computed');
    } else {
      if (!gte(totalAmount, asset.minChannel)) {
        errors.push('total channel size is below the provider minimum');
      }
      if (!gte(asset.maxChannel, totalAmount)) {
        errors.push('total channel size is above the provider maximum');
      }
      if (!hasTwoSidedCapacity(asset, request.direction, request.localAmount, request.remoteAmount, totalAmount)) {
        errors.push('insufficient capacity for the requested direction');
      }
      const liquidity = policy.availableProviderLiquidity?.(request.tokenId);
      if (liquidity !== undefined && parseDecimalAmount(liquidity) === null) {
        errors.push('provider liquidity for this asset is not a valid decimal');
      } else if (liquidity !== undefined && !gte(liquidity, request.remoteAmount)) {
        errors.push('provider liquidity does not cover the provider side of the channel');
      }
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
  // A flat fee is a fee too: convert the full opening fee (flat + bps on the
  // consumer side) into effective basis points before comparing with the
  // consumer's ceiling (OMN-070).
  if (request.maxOpenFeeBps !== undefined && localAtoms !== null) {
    const variable = manifest.fees.openBps !== undefined
      ? applyBps(request.localAmount, manifest.fees.openBps)
      : '0';
    const total = variable === null ? null : addAmounts(manifest.fees.openFlat ?? '0', variable);
    const bps = total === null ? null : effectiveBps(total, request.localAmount);
    if (bps === null) {
      errors.push('open fee could not be evaluated against the request maximum');
    } else if (bps > request.maxOpenFeeBps) {
      errors.push('total open fee exceeds the request maximum');
    }
  }

  return { allowed: errors.length === 0, errors, ...(asset ? { asset } : {}) };
}

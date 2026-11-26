import {
  applyBpsUnits,
  computeOpenFees,
  DEFAULT_FEE_BASIS,
  parseDecimalUnits,
} from '@totemsdk/omnia-lsp';
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
  /** Reject when the total open fee exceeds this decimal amount. */
  maxOpenFee?: string;
  /**
   * Legacy ceiling for the percentage component. Also bounds a flat fee by
   * converting it to the equivalent basis points on the fee basis (OMN-072).
   */
  maxOpenFeeBps?: number;
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
   * Spendable provider funds for the requested asset, decimal units. When set,
   * the provider-side contribution must fit inside it (OMN-067).
   */
  availableProviderFunds?: string;
}

function hasCapacity(asset: OmniaLspAsset, direction: OmniaLspDirection, amount: bigint): boolean {
  if (direction === 'send') return parseUnitsAtLeast(asset.outboundCapacity, amount);
  if (direction === 'receive') return parseUnitsAtLeast(asset.inboundCapacity, amount);
  return parseUnitsAtLeast(asset.inboundCapacity, amount) && parseUnitsAtLeast(asset.outboundCapacity, amount);
}

/** True when `capacity` (decimal) is at least `amount` (units). */
function parseUnitsAtLeast(capacity: string, amount: bigint): boolean {
  const parsed = parseDecimalUnits(capacity, { allowZero: true });
  return parsed.ok && parsed.units >= amount;
}

/** The capacity side the provider itself draws on for a direction. */
function providerCapacitySide(direction: OmniaLspDirection): 'inbound' | 'outbound' | 'both' {
  return direction === 'send' ? 'outbound' : direction === 'receive' ? 'inbound' : 'both';
}

/** The capacity side the consumer's contribution lands on. */
function consumerCapacitySide(direction: OmniaLspDirection): 'inbound' | 'outbound' | 'both' {
  return direction === 'send' ? 'inbound' : direction === 'receive' ? 'outbound' : 'both';
}

function withinCapacity(asset: OmniaLspAsset, side: 'inbound' | 'outbound' | 'both', amount: bigint): boolean {
  if (side === 'both') {
    return parseUnitsAtLeast(asset.inboundCapacity, amount) && parseUnitsAtLeast(asset.outboundCapacity, amount);
  }
  return parseUnitsAtLeast(side === 'inbound' ? asset.inboundCapacity : asset.outboundCapacity, amount);
}

/**
 * Evaluate an open request against a provider manifest.
 *
 * This is the provider's admission policy. It does not reserve capacity; the
 * provider MUST do that through the quote ledger (OMN-068).
 *
 * Both sides of the channel are validated independently (OMN-067): the
 * consumer's `localAmount` and the provider's own `remoteAmount`, because the
 * provider is the party that funds the latter. `now` is the provider's trusted
 * clock — never the requester's (OMN-069).
 */
export function evaluateOpenRequest(
  manifest: OmniaLspManifest,
  request: OmniaLspOpenRequest,
  policy: OmniaLspProviderPolicy = {},
  now = Date.now(),
): OmniaLspOpenDecision {
  const errors: string[] = [];

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
    const local = parseDecimalUnits(request.localAmount);
    const remote = parseDecimalUnits(request.remoteAmount);
    const minChannel = parseDecimalUnits(asset.minChannel, { allowZero: true });
    const maxChannel = parseDecimalUnits(asset.maxChannel, { allowZero: true });

    if (!local.ok) errors.push(`localAmount: ${local.error}`);
    if (!remote.ok) errors.push(`remoteAmount: ${remote.error}`);
    if (!minChannel.ok) errors.push(`manifest asset minChannel: ${minChannel.error}`);
    if (!maxChannel.ok) errors.push(`manifest asset maxChannel: ${maxChannel.error}`);

    if (local.ok && minChannel.ok && maxChannel.ok) {
      if (local.units < minChannel.units) errors.push('localAmount is below the provider minimum');
      if (local.units > maxChannel.units) errors.push('localAmount is above the provider maximum');
    }
    if (remote.ok && minChannel.ok && maxChannel.ok) {
      // OMN-067: the provider's own contribution is a channel limit too.
      if (remote.units < minChannel.units) errors.push('remoteAmount is below the provider minimum');
      if (remote.units > maxChannel.units) errors.push('remoteAmount is above the provider maximum');
    }

    if (local.ok && !withinCapacity(asset, consumerCapacitySide(request.direction), local.units)) {
      errors.push('insufficient capacity for the consumer contribution in the requested direction');
    }
    if (remote.ok && !withinCapacity(asset, providerCapacitySide(request.direction), remote.units)) {
      errors.push('insufficient capacity for the provider contribution in the requested direction');
    }

    if (remote.ok && policy.availableProviderFunds !== undefined) {
      const available = parseDecimalUnits(policy.availableProviderFunds, { allowZero: true });
      if (!available.ok) {
        errors.push(`availableProviderFunds: ${available.error}`);
      } else if (remote.units > available.units) {
        errors.push('provider-side amount exceeds the provider available funds');
      }
    }

    if (local.ok && remote.ok) {
      const fees = computeOpenFees(manifest, request, DEFAULT_FEE_BASIS);
      if (!fees.ok) {
        errors.push(`fee schedule: ${fees.error}`);
      } else {
        const schedule = fees.schedule;
        if (request.maxOpenFee !== undefined) {
          const ceiling = parseDecimalUnits(request.maxOpenFee, { allowZero: true });
          if (!ceiling.ok) {
            errors.push(`maxOpenFee: ${ceiling.error}`);
          } else if (schedule.totalFeeUnits > ceiling.units) {
            errors.push('provider total open fee exceeds the request maximum');
          }
        }
        if (request.maxOpenFeeBps !== undefined) {
          // A flat fee is bounded by converting the ceiling onto the fee basis,
          // so a manifest with openFlat can no longer bypass the check (OMN-072).
          const basis = parseDecimalUnits(schedule.basisAmount, { allowZero: true });
          const bpsCeiling = basis.ok ? applyBpsUnits(basis.units, request.maxOpenFeeBps) : 0n;
          if (schedule.openFeeUnits > bpsCeiling) {
            errors.push('provider open fee exceeds the request maximum rate');
          }
        }
      }
    }
  }

  if (request.lease === true && manifest.terms.lease !== true) {
    errors.push('lease is not offered by the provider');
  }
  if (request.jit === true && manifest.terms.jit !== true) {
    errors.push('JIT is not offered by the provider');
  }

  return { allowed: errors.length === 0, errors, ...(asset ? { asset } : {}) };
}

export { hasCapacity };

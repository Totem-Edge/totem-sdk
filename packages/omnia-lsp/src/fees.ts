/**
 * LSP fee schedule (OMN-072).
 *
 * Two defects motivated one shared implementation:
 *
 *  - admission compared only `openBps` against the consumer's ceiling, so a
 *    manifest with a flat opening fee could charge any amount unchecked;
 *  - quote construction priced percentage and lease fees on the *consumer*
 *    contribution alone, even though the provider is the party supplying the
 *    liquidity the fee is meant to compensate.
 *
 * The basis is now an explicit, signed part of the terms. `total` is the
 * standing basis; `consumer` is retained only so pre-existing quotes remain
 * verifiable.
 */
import type { OmniaLspManifest } from './manifest.js';
import { applyBpsUnits, formatDecimalUnits, parseDecimalUnits } from './decimal.js';

export type OmniaLspFeeBasis = 'consumer' | 'total';

/** Bases an already-issued quote can declare. */
export const DEFAULT_FEE_BASIS: OmniaLspFeeBasis = 'total';

/** Legacy quotes (no `feeBasis`) were priced on the consumer contribution. */
export const LEGACY_FEE_BASIS: OmniaLspFeeBasis = 'consumer';

export interface OmniaLspFeeInput {
  /** Consumer side of the initial channel balance, decimal units. */
  localAmount: string;
  /** Provider side of the initial channel balance, decimal units. */
  remoteAmount: string;
  lease?: boolean;
}

export interface OmniaLspFeeSchedule {
  basis: OmniaLspFeeBasis;
  /** Amount the percentage fees were applied to, in decimal units. */
  basisAmount: string;
  openFee: string;
  openFeeUnits: bigint;
  leaseFee?: string;
  leaseFeeUnits?: bigint;
  /** Sum of every fee the consumer owes at open, in decimal units. */
  totalFee: string;
  totalFeeUnits: bigint;
}

export type FeeScheduleResult =
  | { ok: true; schedule: OmniaLspFeeSchedule }
  | { ok: false; error: string };

function unitsOf(value: string, label: string): { ok: true; units: bigint } | { ok: false; error: string } {
  const parsed = parseDecimalUnits(value, { allowZero: true });
  if (!parsed.ok) return { ok: false, error: `${label}: ${parsed.error}` };
  return { ok: true, units: parsed.units };
}

/**
 * Compute the complete fee schedule for an open request.
 *
 * Flat and percentage fees are resolved into one atom total so admission can
 * compare a single number against the consumer's ceiling.
 */
export function computeOpenFees(
  manifest: OmniaLspManifest,
  input: OmniaLspFeeInput,
  basis: OmniaLspFeeBasis = DEFAULT_FEE_BASIS,
): FeeScheduleResult {
  const local = unitsOf(input.localAmount, 'localAmount');
  if (!local.ok) return local;
  const remote = unitsOf(input.remoteAmount, 'remoteAmount');
  if (!remote.ok) return remote;

  const basisUnits = basis === 'consumer' ? local.units : local.units + remote.units;
  const basisAmount = formatDecimalUnits(basisUnits);

  let openFeeUnits: bigint;
  if (manifest.fees.openFlat !== undefined) {
    const flat = unitsOf(manifest.fees.openFlat, 'manifest.fees.openFlat');
    if (!flat.ok) return flat;
    openFeeUnits = flat.units;
  } else {
    openFeeUnits = applyBpsUnits(basisUnits, manifest.fees.openBps ?? 0);
  }

  let leaseFeeUnits: bigint | undefined;
  if (input.lease === true && manifest.fees.leaseBps !== undefined) {
    leaseFeeUnits = applyBpsUnits(basisUnits, manifest.fees.leaseBps);
  }

  const totalFeeUnits = openFeeUnits + (leaseFeeUnits ?? 0n);
  return {
    ok: true,
    schedule: {
      basis,
      basisAmount,
      openFee: formatDecimalUnits(openFeeUnits),
      openFeeUnits,
      ...(leaseFeeUnits !== undefined
        ? { leaseFee: formatDecimalUnits(leaseFeeUnits), leaseFeeUnits }
        : {}),
      totalFee: formatDecimalUnits(totalFeeUnits),
      totalFeeUnits,
    },
  };
}

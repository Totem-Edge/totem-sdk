/**
 * Token vintage / era metadata.
 *
 * A token's era is derived from its mint date. Older eras are rarer because
 * fewer tokens existed then; era is provenance, not a price prediction.
 */

export type VintageTier = 'GENESIS' | 'SPARTACUS' | 'REX' | 'OG' | 'PIONEER' | 'EXPLORER' | 'FRONTIER';

export interface VintageMeta {
  label: string;
  color: string;
  period: string;
  description: string;
  rarity: string;
}

export const VINTAGE_ORDER: VintageTier[] = [
  'GENESIS',
  'SPARTACUS',
  'REX',
  'OG',
  'PIONEER',
  'EXPLORER',
  'FRONTIER',
];

export const VINTAGE_META: Record<VintageTier, VintageMeta> = {
  GENESIS: {
    label: 'GENESIS',
    color: '#9B59B6',
    period: 'Q1–Q2 2023',
    description: 'The first Minima token era, before the Spartacus upgrade era.',
    rarity: 'Earliest mint window; the smallest supply of tokens and the scarcest era.',
  },
  SPARTACUS: {
    label: 'SPARTACUS',
    color: '#FFD700',
    period: 'Q3–Q4 2023',
    description: 'Tokens minted during the Spartacus era in the second half of 2023.',
    rarity: 'Early-era token; much rarer than 2024+ mints, but not Genesis.',
  },
  REX: {
    label: 'REX',
    color: '#00D9B5',
    period: 'H1 2024',
    description: 'First half of 2024, as the Minima ecosystem began to grow.',
    rarity: 'Early ecosystem era; more common than 2023, scarcer than 2025+.',
  },
  OG: {
    label: 'OG',
    color: '#00FF88',
    period: 'H2 2024',
    description: 'Second half of 2024, the established community era.',
    rarity: 'Original-community era; still early, but with a larger mint window.',
  },
  PIONEER: {
    label: 'PIONEER',
    color: '#6C8EF5',
    period: '2025',
    description: 'Tokens minted in 2025 as the network and tooling matured.',
    rarity: 'Pioneer era; newer than the original cohorts.',
  },
  EXPLORER: {
    label: 'EXPLORER',
    color: '#C0C0C0',
    period: '2026',
    description: 'Tokens minted in 2026 during the current expansion phase.',
    rarity: 'Current-era mints; the most common era so far.',
  },
  FRONTIER: {
    label: 'FRONTIER',
    color: 'var(--text-muted)',
    period: '2027+',
    description: 'Future mints, after the current expansion phase.',
    rarity: 'Frontier era; newest mints, with no historical scarcity yet.',
  },
};

export const NFT_RARITY_TIERS = [
  { label: 'UNIQUE', detail: '1 edition' },
  { label: 'ULTRA RARE', detail: '2–10 editions' },
  { label: 'RARE', detail: '11–100 editions' },
  { label: 'LIMITED EDITION', detail: '101–1,000 editions' },
  { label: 'OPEN EDITION', detail: 'More than 1,000 editions' },
];

const ANCHOR_BLOCK = 1_977_800;
const ANCHOR_TIME_MS = 1_772_640_000_000;
const AVG_BLOCK_MS = 64_000;

export function estimateMintTimestamp(mintBlock: number): number {
  return ANCHOR_TIME_MS - (ANCHOR_BLOCK - mintBlock) * AVG_BLOCK_MS;
}

export function getVintageTier(ts: number): VintageTier {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = d.getMonth();
  if (y < 2023 || (y === 2023 && m <= 5)) return 'GENESIS';
  if (y === 2023) return 'SPARTACUS';
  if (y === 2024 && m <= 5) return 'REX';
  if (y === 2024) return 'OG';
  if (y === 2025) return 'PIONEER';
  if (y === 2026) return 'EXPLORER';
  return 'FRONTIER';
}

/** NFT supply rarity, matching the token-detail badge. */
export function getNftRarityLabel(totalSupply?: number): string | undefined {
  if (!totalSupply || totalSupply <= 0) return undefined;
  if (totalSupply === 1) return 'UNIQUE';
  if (totalSupply <= 10) return 'ULTRA RARE';
  if (totalSupply <= 100) return 'RARE';
  if (totalSupply <= 1_000) return 'LIMITED EDITION';
  return 'OPEN EDITION';
}

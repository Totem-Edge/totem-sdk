export const DEFAULT_LIQUIDITY_BOND_TOPIC_PREFIX = 'totem.liquidity-bond.v1';
export const DEFAULT_MINIMA_TOKEN_ID = '0x00';

export const DEFAULT_LIQUIDITY_RISK_POLICY = {
  haircutBps: 2000,
  maxAllocationBps: 8000,
  requireIdentity: true,
  requireProviderBond: false,
} as const;

export const DEFAULT_MINIMA_TOKEN_ID = '0x00';
export const PROVIDER_BOND_TOPIC_PREFIX = 'totem.provider-bond.v1';

export const DEFAULT_PROVIDER_SCORING_WEIGHTS = {
  identity: 0.25,
  bond: 0.30,
  reliability: 0.30,
  incidents: 0.15,
} as const;

export const SEVERITY_ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const RECOMMENDATION_THRESHOLDS = {
  recommended: 80,
  acceptable: 60,
  risky: 40,
  avoid: 20,
} as const;

export const MAX_HEARTBEAT_AGE_MS_DEFAULT = 120_000;

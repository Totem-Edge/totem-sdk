import type {
  ProviderScore,
  ProviderRecommendation,
  ComputeProviderScoreParams,
  ProbeResult,
  IncidentRecord,
} from './types.js';
import { DEFAULT_PROVIDER_SCORING_WEIGHTS, RECOMMENDATION_THRESHOLDS, MAX_HEARTBEAT_AGE_MS_DEFAULT } from './constants.js';

export function computeProviderScore(params: ComputeProviderScoreParams): ProviderScore {
  const { provider, bondProofs, probes, incidents, now, weights } = params;
  const w = weights ?? DEFAULT_PROVIDER_SCORING_WEIGHTS;
  const ts = now ?? Date.now();

  const reasons: string[] = [];

  let identityScore = 0;
  if (provider.providerBond.bondOwnerAddress) {
    identityScore = 100;
    reasons.push('Identity address declared');
  } else {
    reasons.push('No identity address declared');
  }

  let bondScore = 0;
  const hasBond = provider.providerBond.bondStack && provider.providerBond.bondStack.length > 0;
  const hasMinimaBond = hasBond && provider.providerBond.bondStack!.some(
    (d) => d.asset === 'MINIMA' && d.purpose === 'hard-collateral' && d.status === 'active'
  );
  const hasProof = bondProofs && bondProofs.length > 0;

  if (hasMinimaBond && hasProof) {
    bondScore = 100;
    reasons.push('Active MINIMA hard-collateral bond with proof');
  } else if (hasMinimaBond) {
    bondScore = 70;
    reasons.push('MINIMA bond declared but no proof attached');
  } else if (hasBond) {
    bondScore = 40;
    reasons.push('Bond declared but not MINIMA hard-collateral');
  } else {
    reasons.push('No bond declared');
  }

  let reliabilityScore = 50;
  const providerProbes = probes ?? [];
  if (providerProbes.length > 0) {
    const recentProbes = providerProbes.filter((p) => ts - p.observedAt < MAX_HEARTBEAT_AGE_MS_DEFAULT);
    if (recentProbes.length > 0) {
      const successRate = recentProbes.filter((p) => p.ok).length / recentProbes.length;
      const avgLatency = recentProbes.reduce((sum, p) => sum + (p.latencyMs ?? 0), 0) / recentProbes.length;

      reliabilityScore = successRate * 100;
      if (avgLatency > 1000) reliabilityScore -= 20;
      else if (avgLatency > 500) reliabilityScore -= 10;

      reasons.push(`Probe success rate: ${(successRate * 100).toFixed(0)}%`);
    } else {
      reliabilityScore = 0;
      reasons.push('No recent probes (offline)');
    }
  } else {
    reasons.push('No probe data');
  }

  let incidentScore = 100;
  const providerIncidents = incidents ?? [];
  if (providerIncidents.length > 0) {
    const openIncidents = providerIncidents.filter((i) => i.status === 'open');
    const criticalIncidents = providerIncidents.filter((i) => i.severity === 'critical');
    const highIncidents = providerIncidents.filter((i) => i.severity === 'high');

    incidentScore = 100 - (openIncidents.length * 10) - (criticalIncidents.length * 20) - (highIncidents.length * 10);
    incidentScore = Math.max(0, incidentScore);

    if (criticalIncidents.length > 0) reasons.push(`${criticalIncidents.length} critical incident(s)`);
    if (highIncidents.length > 0) reasons.push(`${highIncidents.length} high-severity incident(s)`);
    if (openIncidents.length > 0) reasons.push(`${openIncidents.length} open incident(s)`);
  } else {
    reasons.push('No incidents');
  }

  const totalScore = Math.round(
    identityScore * w.identity +
    bondScore * w.bond +
    reliabilityScore * w.reliability +
    incidentScore * w.incidents
  );

  const recommendation = computeProviderRecommendation(totalScore);

  return {
    providerId: provider.providerBond.providerId,
    score: totalScore,
    recommendation,
    bondScore,
    identityScore,
    reliabilityScore,
    incidentScore,
    computedAt: ts,
    reasons,
  };
}

export function computeProviderRecommendation(score: number): ProviderRecommendation {
  if (score >= RECOMMENDATION_THRESHOLDS.recommended) return 'recommended';
  if (score >= RECOMMENDATION_THRESHOLDS.acceptable) return 'acceptable';
  if (score >= RECOMMENDATION_THRESHOLDS.risky) return 'risky';
  if (score >= RECOMMENDATION_THRESHOLDS.avoid) return 'avoid';
  if (score > 0) return 'unbonded';
  return 'offline';
}

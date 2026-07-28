import type {
  ProviderBondRegistryState,
  ProviderPolicy,
  PolicyMatch,
  ProviderBondManifest,
  ProviderScore,
} from './types.js';
import { MAX_HEARTBEAT_AGE_MS_DEFAULT } from './constants.js';

export function filterProvidersByPolicy(state: ProviderBondRegistryState, policy: ProviderPolicy): PolicyMatch[] {
  const providers = Object.values(state.providers);
  const now = policy.now ?? Date.now();

  return providers.map((provider) => {
    const reasons: string[] = [];
    const failures: string[] = [];
    const score = state.scores[provider.providerBond.providerId];

    if (policy.serviceType && provider.edgeService.serviceType !== policy.serviceType) {
      failures.push(`Service type ${provider.edgeService.serviceType} does not match required ${policy.serviceType}`);
    }

    if (policy.minScore !== undefined && score) {
      if (score.score < policy.minScore) {
        failures.push(`Score ${score.score} is below minimum ${policy.minScore}`);
      } else {
        reasons.push(`Score ${score.score} meets minimum ${policy.minScore}`);
      }
    }

    if (policy.requireIdentity) {
      if (!provider.providerBond.bondOwnerAddress) {
        failures.push('Identity not declared');
      } else {
        reasons.push('Identity declared');
      }
    }

    if (policy.requireActiveBond) {
      const hasActiveBond = provider.providerBond.bondStack?.some(
        (d) => d.status === 'active'
      );
      if (!hasActiveBond) {
        failures.push('No active bond');
      } else {
        reasons.push('Active bond present');
      }
    }

    if (policy.requireMinimaHardCollateral) {
      const hasMinimaHardCollateral = provider.providerBond.bondStack?.some(
        (d) => d.asset === 'MINIMA' && d.purpose === 'hard-collateral' && d.status === 'active'
      );
      if (!hasMinimaHardCollateral) {
        failures.push('No active MINIMA hard-collateral bond');
      } else {
        reasons.push('MINIMA hard-collateral bond present');
      }
    }

    if (policy.minBondAmount !== undefined) {
      const totalBond = provider.providerBond.bondStack?.reduce(
        (sum, d) => sum + d.amount, 0n
      ) ?? 0n;
      if (totalBond < policy.minBondAmount) {
        failures.push(`Total bond ${totalBond.toString()} is below minimum ${policy.minBondAmount.toString()}`);
      } else {
        reasons.push(`Total bond ${totalBond.toString()} meets minimum ${policy.minBondAmount.toString()}`);
      }
    }

    if (policy.acceptedAssets && policy.acceptedAssets.length > 0) {
      const bondAssets = new Set(provider.providerBond.bondStack?.map((d) => d.asset) ?? []);
      const hasAccepted = policy.acceptedAssets.some((a) => bondAssets.has(a));
      if (!hasAccepted) {
        failures.push('No bond in accepted assets');
      } else {
        reasons.push('Bond asset accepted');
      }
    }

    if (policy.acceptedPurposes && policy.acceptedPurposes.length > 0) {
      const bondPurposes = new Set(provider.providerBond.bondStack?.map((d) => d.purpose) ?? []);
      const hasAccepted = policy.acceptedPurposes.some((p) => bondPurposes.has(p));
      if (!hasAccepted) {
        failures.push('No bond with accepted purpose');
      } else {
        reasons.push('Bond purpose accepted');
      }
    }

    if (policy.maxIncidentSeverity) {
      const providerIncidents = state.incidents[provider.providerBond.providerId] ?? [];
      const severityOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      const maxSeen = providerIncidents.reduce((max, i) => {
        const s = severityOrder[i.severity] ?? 0;
        return s > max ? s : max;
      }, 0);
      const policyMax = severityOrder[policy.maxIncidentSeverity] ?? 0;
      if (maxSeen > policyMax) {
        failures.push(`Incident severity exceeds policy maximum`);
      } else {
        reasons.push('Incident severity within policy limits');
      }
    }

    if (policy.maxHeartbeatAgeMs !== undefined) {
      const providerProbes = state.probes[provider.providerBond.providerId] ?? [];
      const heartbeats = providerProbes.filter((p) => p.type === 'heartbeat');
      const lastHeartbeat = heartbeats.length > 0
        ? heartbeats.reduce((max, h) => h.observedAt > max ? h.observedAt : max, 0)
        : 0;
      if (now - lastHeartbeat > policy.maxHeartbeatAgeMs) {
        failures.push(`Last heartbeat too old (${now - lastHeartbeat}ms > ${policy.maxHeartbeatAgeMs}ms)`);
      } else if (lastHeartbeat > 0) {
        reasons.push('Heartbeat is recent');
      }
    }

    return {
      providerId: provider.providerBond.providerId,
      provider,
      matched: failures.length === 0,
      score,
      reasons,
      failures,
    };
  });
}

export function rankProvidersByPolicy(matches: PolicyMatch[]): PolicyMatch[] {
  return [...matches].sort((a, b) => {
    if (a.matched && !b.matched) return -1;
    if (!a.matched && b.matched) return 1;
    const scoreA = a.score?.score ?? 0;
    const scoreB = b.score?.score ?? 0;
    return scoreB - scoreA;
  });
}

export function explainProviderPolicyMatch(match: PolicyMatch): string[] {
  const lines: string[] = [];
  lines.push(`Provider: ${match.providerId}`);
  lines.push(`Matched: ${match.matched}`);
  if (match.score) {
    lines.push(`Score: ${match.score.score} (${match.score.recommendation})`);
  }
  if (match.reasons.length > 0) {
    lines.push('Passed checks:');
    for (const r of match.reasons) lines.push(`  + ${r}`);
  }
  if (match.failures.length > 0) {
    lines.push('Failed checks:');
    for (const f of match.failures) lines.push(`  - ${f}`);
  }
  return lines;
}

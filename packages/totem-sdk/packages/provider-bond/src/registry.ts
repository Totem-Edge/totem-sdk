import type {
  ProviderBondRegistryState,
  ProviderBondManifest,
  BondProofRef,
  ProbeResult,
  IncidentRecord,
  ProviderScore,
} from './types.js';

export function createEmptyProviderBondRegistryState(): ProviderBondRegistryState {
  return {
    providers: {},
    bondProofs: {},
    probes: {},
    incidents: {},
    scores: {},
    updatedAt: Date.now(),
  };
}

export function registerProvider(
  state: ProviderBondRegistryState,
  manifest: ProviderBondManifest
): ProviderBondRegistryState {
  const providers = { ...state.providers };
  providers[manifest.providerBond.providerId] = manifest;
  return { ...state, providers, updatedAt: Date.now() };
}

export function updateProviderManifest(
  state: ProviderBondRegistryState,
  manifest: ProviderBondManifest
): ProviderBondRegistryState {
  return registerProvider(state, manifest);
}

export function attachBondProof(
  state: ProviderBondRegistryState,
  providerId: string,
  proof: BondProofRef
): ProviderBondRegistryState {
  const bondProofs = { ...state.bondProofs };
  const existing = bondProofs[providerId] ?? [];
  bondProofs[providerId] = [...existing, proof];
  return { ...state, bondProofs, updatedAt: Date.now() };
}

export function recordProviderProbe(
  state: ProviderBondRegistryState,
  providerId: string,
  probe: ProbeResult
): ProviderBondRegistryState {
  const probes = { ...state.probes };
  const existing = probes[providerId] ?? [];
  probes[providerId] = [...existing, probe];
  return { ...state, probes, updatedAt: Date.now() };
}

export function recordProviderIncident(
  state: ProviderBondRegistryState,
  providerId: string,
  incident: IncidentRecord
): ProviderBondRegistryState {
  const incidents = { ...state.incidents };
  const existing = incidents[providerId] ?? [];
  incidents[providerId] = [...existing, incident];
  return { ...state, incidents, updatedAt: Date.now() };
}

export function updateProviderScore(
  state: ProviderBondRegistryState,
  providerId: string,
  score: ProviderScore
): ProviderBondRegistryState {
  const scores = { ...state.scores };
  scores[providerId] = score;
  return { ...state, scores, updatedAt: Date.now() };
}

export function listProviders(state: ProviderBondRegistryState): ProviderBondManifest[] {
  return Object.values(state.providers);
}

export function getProvider(
  state: ProviderBondRegistryState,
  providerId: string
): ProviderBondManifest | undefined {
  return state.providers[providerId];
}

export function listProvidersByServiceType(
  state: ProviderBondRegistryState,
  serviceType: string
): ProviderBondManifest[] {
  return Object.values(state.providers).filter(
    (p) => p.edgeService.serviceType === serviceType
  );
}

export function listRiskyProviders(
  state: ProviderBondRegistryState,
  threshold: number
): ProviderBondManifest[] {
  return Object.values(state.providers).filter((p) => {
    const score = state.scores[p.providerBond.providerId];
    return score && score.score < threshold;
  });
}

export function listOfflineProviders(
  state: ProviderBondRegistryState,
  maxHeartbeatAgeMs: number,
  now: number
): ProviderBondManifest[] {
  return Object.values(state.providers).filter((p) => {
    const providerProbes = state.probes[p.providerBond.providerId] ?? [];
    const heartbeats = providerProbes.filter((pr) => pr.type === 'heartbeat');
    if (heartbeats.length === 0) return true;
    const lastHeartbeat = heartbeats.reduce((max, h) => h.observedAt > max ? h.observedAt : max, 0);
    return now - lastHeartbeat > maxHeartbeatAgeMs;
  });
}

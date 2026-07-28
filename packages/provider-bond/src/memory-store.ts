import type {
  ProviderBondManifest,
  ProviderBondRegistryState,
  BondProofRef,
  ProbeResult,
  IncidentRecord,
  ProviderScore,
} from './types.js';
import {
  createEmptyProviderBondRegistryState,
  registerProvider,
  updateProviderManifest,
  attachBondProof,
  recordProviderProbe,
  recordProviderIncident,
  updateProviderScore,
  listProviders,
  getProvider,
  listProvidersByServiceType,
  listRiskyProviders,
  listOfflineProviders,
} from './registry.js';

export class MemoryProviderBondStore {
  private state: ProviderBondRegistryState;

  constructor() {
    this.state = createEmptyProviderBondRegistryState();
  }

  async registerProvider(manifest: ProviderBondManifest): Promise<void> {
    this.state = registerProvider(this.state, manifest);
  }

  async updateProviderManifest(manifest: ProviderBondManifest): Promise<void> {
    this.state = updateProviderManifest(this.state, manifest);
  }

  async attachBondProof(providerId: string, proof: BondProofRef): Promise<void> {
    this.state = attachBondProof(this.state, providerId, proof);
  }

  async recordProbe(providerId: string, probe: ProbeResult): Promise<void> {
    this.state = recordProviderProbe(this.state, providerId, probe);
  }

  async recordIncident(providerId: string, incident: IncidentRecord): Promise<void> {
    this.state = recordProviderIncident(this.state, providerId, incident);
  }

  async updateScore(providerId: string, score: ProviderScore): Promise<void> {
    this.state = updateProviderScore(this.state, providerId, score);
  }

  async listProviders(): Promise<ProviderBondManifest[]> {
    return listProviders(this.state);
  }

  async getProvider(providerId: string): Promise<ProviderBondManifest | undefined> {
    return getProvider(this.state, providerId);
  }

  async listProvidersByServiceType(serviceType: string): Promise<ProviderBondManifest[]> {
    return listProvidersByServiceType(this.state, serviceType);
  }

  async listRiskyProviders(threshold: number): Promise<ProviderBondManifest[]> {
    return listRiskyProviders(this.state, threshold);
  }

  async listOfflineProviders(maxHeartbeatAgeMs: number, now: number): Promise<ProviderBondManifest[]> {
    return listOfflineProviders(this.state, maxHeartbeatAgeMs, now);
  }

  async getSnapshot(): Promise<ProviderBondRegistryState> {
    return JSON.parse(JSON.stringify(this.state, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  }
}

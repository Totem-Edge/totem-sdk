import * as providerBond from '../index.js';

describe('index', () => {
  const EXPECTED_EXPORTS = [
    'createProviderBondManifest',
    'computeProviderBondExtensionHash',
    'computeProviderBondManifestHash',
    'verifyProviderBondManifest',
    'assertManifestNotExpired',
    'bindProviderManifestToIdentity',
    'verifyProviderManifestIdentity',
    'verifyProviderBondAddresses',
    'assertProviderControlsAddress',
    'verifyBondProof',
    'assertBondMeetsMinimum',
    'verifyBondStack',
    'recordProbe',
    'recordHeartbeat',
    'recordIncident',
    'acknowledgeIncident',
    'resolveIncident',
    'rejectIncident',
    'computeProviderScore',
    'computeProviderRecommendation',
    'filterProvidersByPolicy',
    'rankProvidersByPolicy',
    'explainProviderPolicyMatch',
    'createEmptyProviderBondRegistryState',
    'registerProvider',
    'updateProviderManifest',
    'attachBondProof',
    'recordProviderProbe',
    'recordProviderIncident',
    'updateProviderScore',
    'listProviders',
    'getProvider',
    'listProvidersByServiceType',
    'listRiskyProviders',
    'listOfflineProviders',
    'MemoryProviderBondStore',
    'serializeProviderBondState',
    'parseProviderBondState',
    'DEFAULT_MINIMA_TOKEN_ID',
    'PROVIDER_BOND_TOPIC_PREFIX',
    'DEFAULT_PROVIDER_SCORING_WEIGHTS',
    'ProviderBondError',
    'ProviderManifestError',
    'ProviderIdentityError',
    'BondProofError',
    'ProviderPolicyError',
  ];

  it('exports all expected symbols', () => {
    for (const name of EXPECTED_EXPORTS) {
      const val = (providerBond as Record<string, unknown>)[name];
      if (val === undefined) {
        throw new Error(`Missing export: ${name}`);
      }
      expect(val).toBeDefined();
    }
  });

  it('package imports correctly', () => {
    expect(providerBond.createProviderBondManifest).toBeInstanceOf(Function);
    expect(providerBond.MemoryProviderBondStore).toBeDefined();
    expect(providerBond.DEFAULT_MINIMA_TOKEN_ID).toBe('0x00');
  });
});

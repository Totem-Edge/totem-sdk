import { loadConfigFromEnv } from '../config.js';

describe('loadConfigFromEnv', () => {
  it('loads documented defaults', () => {
    expect(loadConfigFromEnv({})).toEqual({
      port: 50052,
      host: '127.0.0.1',
      dbPath: expect.stringContaining('.totem/omnia/omnia.sqlite'),
      chainRpcUrl: 'http://127.0.0.1:9005',
      chainRpcPassword: undefined,
      analyticsDbPath: undefined,
      relay: undefined,
      localPubkey: undefined,
      localPartyId: undefined,
      localAddressIndex: undefined,
      localSettlementAddress: undefined,
      nodeMode: undefined,
      wsPath: '/rpc',
    });
  });

  it('parses configured values and ignores blank optional values', () => {
    expect(loadConfigFromEnv({
      OMNIA_HOST_PORT: '51000',
      OMNIA_HOST_DB: '/data/omnia.sqlite',
      OMNIA_CHAIN_RPC: 'https://node.example:9005',
      OMNIA_CHAIN_RPC_PASSWORD: 'secret',
      OMNIA_ANALYTICS_DB: ' /data/analytics.duckdb ',
      OMNIA_RELAY: '  ',
      OMNIA_LOCAL_PUBKEY: 'pubkey',
      OMNIA_LOCAL_PARTY_ID: 'alice',
      OMNIA_LOCAL_ADDRESS_INDEX: '3',
      OMNIA_LOCAL_SETTLEMENT_ADDRESS: 'MxAddress',
      OMNIA_HOST_BIND: '0.0.0.0',
      OMNIA_NODE_MODE: 'omnia',
    })).toEqual({
      port: 51000,
      host: '0.0.0.0',
      dbPath: '/data/omnia.sqlite',
      chainRpcUrl: 'https://node.example:9005',
      chainRpcPassword: 'secret',
      analyticsDbPath: '/data/analytics.duckdb',
      relay: undefined,
      localPubkey: 'pubkey',
      localPartyId: 'alice',
      localAddressIndex: 3,
      localSettlementAddress: 'MxAddress',
      nodeMode: 'omnia',
      wsPath: '/rpc',
    });
  });

  it('rejects invalid ports', () => {
    expect(() => loadConfigFromEnv({ OMNIA_HOST_PORT: '70000' })).toThrow(
      'OMNIA_HOST_PORT must be an integer between 1 and 65535',
    );
  });
});

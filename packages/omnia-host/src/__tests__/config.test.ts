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
      seed: undefined,
      keyfile: undefined,
      keyfilePassphrase: undefined,
      deviceId: undefined,
      readOnly: false,
      identityFile: undefined,
      serviceType: 'omnia-router',
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
      seed: undefined,
      keyfile: undefined,
      keyfilePassphrase: undefined,
      deviceId: undefined,
      readOnly: false,
      identityFile: undefined,
      serviceType: 'omnia-router',
    });
  });

  it('rejects invalid ports', () => {
    expect(() => loadConfigFromEnv({ OMNIA_HOST_PORT: '70000' })).toThrow(
      'OMNIA_HOST_PORT must be an integer between 1 and 65535',
    );
  });

  it('accepts a BIP39 mnemonic seed', () => {
    const config = loadConfigFromEnv({
      OMNIA_HOST_SEED: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    });
    expect(config.seed).toContain('abandon');
  });

  it('accepts a 32-byte hex seed', () => {
    const config = loadConfigFromEnv({ OMNIA_HOST_SEED: '0x' + 'ab'.repeat(32) });
    expect(config.seed).toBe('0x' + 'ab'.repeat(32));
  });

  it('rejects a malformed seed with format guidance', () => {
    expect(() => loadConfigFromEnv({ OMNIA_HOST_SEED: 'not-a-seed!!' })).toThrow(
      'OMNIA_HOST_SEED must be a BIP39 mnemonic (12+ words) or a hex seed',
    );
    expect(() => loadConfigFromEnv({ OMNIA_HOST_SEED: '0xabcd' })).toThrow(
      'OMNIA_HOST_SEED hex form must be exactly 32 bytes',
    );
  });

  it('rejects setting both SEED and KEYFILE', () => {
    expect(() => loadConfigFromEnv({
      OMNIA_HOST_SEED: '0x' + 'ab'.repeat(32),
      OMNIA_HOST_KEYFILE: './keyfile.json',
    })).toThrow('OMNIA_HOST_SEED and OMNIA_HOST_KEYFILE are mutually exclusive');
  });

  it('parses keyfile, passphrase, device id, read-only, identity, and service type', () => {
    const config = loadConfigFromEnv({
      OMNIA_HOST_KEYFILE: './keys/host.json',
      OMNIA_HOST_KEYFILE_PASSPHRASE: 'hunter2',
      OMNIA_HOST_DEVICE_ID: 'device-3',
      OMNIA_HOST_READ_ONLY: '1',
      OMNIA_HOST_IDENTITY_FILE: './identity.json',
      OMNIA_HOST_SERVICE_TYPE: 'lookup-provider',
    });
    expect(config.keyfile).toBe('./keys/host.json');
    expect(config.keyfilePassphrase).toBe('hunter2');
    expect(config.deviceId).toBe('device-3');
    expect(config.readOnly).toBe(true);
    expect(config.identityFile).toBe('./identity.json');
    expect(config.serviceType).toBe('lookup-provider');
  });
});

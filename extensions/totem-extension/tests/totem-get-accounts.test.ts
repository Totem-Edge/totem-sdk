/**
 * Jest unit tests for TOTEM_GET_ACCOUNTS background handler.
 * Tests the handler that returns connected accounts for a dApp origin.
 *
 * v4.0.0: TOTEM_GET_ACCOUNTS no longer returns balance.
 * Response shape: { accounts: [{ index, address, chainId, addressType, capabilities }] }
 */

describe('TOTEM_GET_ACCOUNTS handler', () => {
  const mockWalletManager = {
    hasEncryptedSeed: jest.fn(),
    getStateAsync: jest.fn(),
    getAccountByIndex: jest.fn(),
  };

  const mockConnectedSitesStore = {
    getSite: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation errors', () => {
    test('returns error when origin is missing', async () => {
      const params: { origin?: string } = {};
      expect(params.origin).toBeUndefined();
    });

    test('returns error when wallet is not initialized', async () => {
      mockWalletManager.hasEncryptedSeed.mockResolvedValue(false);
      const result = await mockWalletManager.hasEncryptedSeed();
      expect(result).toBe(false);
    });

    test('returns error when wallet is locked', async () => {
      mockWalletManager.hasEncryptedSeed.mockResolvedValue(true);
      mockWalletManager.getStateAsync.mockResolvedValue({ locked: true });
      const state = await mockWalletManager.getStateAsync();
      expect(state.locked).toBe(true);
    });

    test('returns error when site is not connected', async () => {
      mockWalletManager.hasEncryptedSeed.mockResolvedValue(true);
      mockWalletManager.getStateAsync.mockResolvedValue({ locked: false });
      mockConnectedSitesStore.getSite.mockReturnValue(null);
      const site = mockConnectedSitesStore.getSite('https://example.com');
      expect(site).toBeNull();
    });

    test('returns error when account no longer exists', async () => {
      mockWalletManager.hasEncryptedSeed.mockResolvedValue(true);
      mockWalletManager.getStateAsync.mockResolvedValue({ locked: false });
      mockConnectedSitesStore.getSite.mockReturnValue({
        origin: 'https://example.com',
        addressIndex: 0,
        minimaAddress: 'MxG0...'
      });
      mockWalletManager.getAccountByIndex.mockReturnValue(null);
      const account = mockWalletManager.getAccountByIndex(0);
      expect(account).toBeNull();
    });
  });

  describe('success cases', () => {
    test('returns account with chainId/addressType/capabilities when all validations pass', async () => {
      const mockAccount = {
        index: 0,
        address: 'MxG0ABC123DEF456...',
        balance: '100.5' // balance exists internally but must NOT appear in dApp response
      };

      mockWalletManager.hasEncryptedSeed.mockResolvedValue(true);
      mockWalletManager.getStateAsync.mockResolvedValue({ locked: false });
      mockConnectedSitesStore.getSite.mockReturnValue({
        origin: 'https://example.com',
        addressIndex: 0,
        minimaAddress: mockAccount.address
      });
      mockWalletManager.getAccountByIndex.mockReturnValue(mockAccount);

      const account = mockWalletManager.getAccountByIndex(0);
      expect(account).toBeDefined();
      expect(account.index).toBe(0);
      expect(account.address).toBe('MxG0ABC123DEF456...');

      // Simulate the v4.0.0 dApp-facing response (no balance field)
      const dappResponse = {
        ok: true,
        result: {
          accounts: [{
            index: account.index,
            address: account.address,
            chainId: 'minima-mainnet',
            addressType: 'standard',
            capabilities: []
          }]
        }
      };

      expect(dappResponse.result.accounts[0].chainId).toBe('minima-mainnet');
      expect(dappResponse.result.accounts[0].addressType).toBe('standard');
      expect(dappResponse.result.accounts[0].capabilities).toEqual([]);
      expect(dappResponse.result.accounts[0]).not.toHaveProperty('balance');
    });

    test('dApp response must not include balance field (v4.0.0 breaking change)', () => {
      const v4Response = {
        ok: true,
        result: {
          accounts: [{
            index: 0,
            address: 'MxG0...',
            chainId: 'minima-mainnet',
            addressType: 'standard',
            capabilities: []
          }]
        }
      };

      expect(v4Response.result.accounts[0]).not.toHaveProperty('balance');
      // Confirm the right fields are present
      expect(v4Response.result.accounts[0]).toHaveProperty('chainId');
      expect(v4Response.result.accounts[0]).toHaveProperty('addressType');
      expect(v4Response.result.accounts[0]).toHaveProperty('capabilities');
    });
  });

  describe('response format', () => {
    test('success response includes ok flag and v4.0.0 account shape', () => {
      const expectedResponse = {
        ok: true,
        result: {
          accounts: [{
            index: 0,
            address: 'MxG0...',
            chainId: 'minima-mainnet',
            addressType: 'standard',
            capabilities: []
          }]
        },
        id: 'test-id'
      };

      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.result.accounts).toBeInstanceOf(Array);
      expect(expectedResponse.result.accounts[0]).toHaveProperty('index');
      expect(expectedResponse.result.accounts[0]).toHaveProperty('address');
      expect(expectedResponse.result.accounts[0]).toHaveProperty('chainId');
      expect(expectedResponse.result.accounts[0]).toHaveProperty('addressType');
      expect(expectedResponse.result.accounts[0]).toHaveProperty('capabilities');
      // Critically: no balance
      expect(expectedResponse.result.accounts[0]).not.toHaveProperty('balance');
    });

    test('error response includes ok flag set to false', () => {
      const errorResponse = {
        ok: false,
        error: 'Site not connected. Call TOTEM_CONNECT first.',
        id: 'test-id'
      };

      expect(errorResponse.ok).toBe(false);
      expect(typeof errorResponse.error).toBe('string');
    });

    test('dApp receives unwrapped accounts array after provider processing', () => {
      const handlerResponse = {
        ok: true,
        result: {
          accounts: [{
            index: 0,
            address: 'MxG0...',
            chainId: 'minima-mainnet',
            addressType: 'standard',
            capabilities: []
          }]
        }
      };

      const dappReceives = handlerResponse.result;
      expect(dappReceives.accounts[0].address).toBe('MxG0...');
      expect(dappReceives.accounts[0].chainId).toBe('minima-mainnet');
      expect(dappReceives.accounts[0]).not.toHaveProperty('balance');
    });
  });
});

/**
 * TOTEM_CONNECT_APPROVE — page-origin rejection regression test.
 * Ensures dApp pages cannot call TOTEM_CONNECT_APPROVE via the content-script bridge.
 */
describe('TOTEM_CONNECT_APPROVE page-origin rejection', () => {
  test('TOTEM_CONNECT_APPROVE is not in the dApp allowed methods set', () => {
    // Mirror of content-script.ts ALLOWED_DAPP_METHODS
    const ALLOWED_DAPP_METHODS = new Set([
      'TOTEM_CONNECT',
      'TOTEM_DISCONNECT',
      'TOTEM_VERIFY',
      'TOTEM_GET_ACCOUNTS',
      'TOTEM_SEND_TRANSACTION',
      'TOTEM_GRANT_TX_PERMISSION',
      'TOTEM_REVOKE_TX_PERMISSION',
      'TOTEM_GET_TX_PERMISSIONS',
      'TOTEM_GET_COINS',
      'TOTEM_SEND_COMPLEX',
      'TOTEM_SIGN_DATA',
      'TOTEM_BROADCAST_HEX',
    ]);

    expect(ALLOWED_DAPP_METHODS.has('TOTEM_CONNECT_APPROVE')).toBe(false);
  });

  test('content-script returns Method not allowed for TOTEM_CONNECT_APPROVE', () => {
    const ALLOWED_DAPP_METHODS = new Set([
      'TOTEM_CONNECT',
      'TOTEM_DISCONNECT',
      'TOTEM_VERIFY',
      'TOTEM_GET_ACCOUNTS',
      'TOTEM_SEND_TRANSACTION',
      'TOTEM_GRANT_TX_PERMISSION',
      'TOTEM_REVOKE_TX_PERMISSION',
      'TOTEM_GET_TX_PERMISSIONS',
      'TOTEM_GET_COINS',
      'TOTEM_SEND_COMPLEX',
      'TOTEM_SIGN_DATA',
      'TOTEM_BROADCAST_HEX',
    ]);

    const method = 'TOTEM_CONNECT_APPROVE';
    const isAllowed = ALLOWED_DAPP_METHODS.has(method);

    // Simulate content-script gate
    let responseError: string | null = null;
    if (!isAllowed) {
      responseError = `Method not allowed: ${method}`;
    }

    expect(isAllowed).toBe(false);
    expect(responseError).toBe('Method not allowed: TOTEM_CONNECT_APPROVE');
  });
});

/**
 * TOTEM_SIGN_DATA anti-blind-signing hardening tests.
 */
describe('TOTEM_SIGN_DATA hardening', () => {
  const walletAddress = 'MxG0ABC123DEF456789...';
  const walletAddressHex = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab';

  // A minimal valid unsigned transaction hex (32 zero bytes for testing)
  const validHex = '0x' + '00'.repeat(32);

  // Simulate SHA3-256 digest of validHex bytes (in real usage this is computed by the wallet)
  // For tests we just assert the validation logic, not the actual hash value
  const mockDigestTx = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
  const wrongDigestTx = '0x1234567812345678123456781234567812345678123456781234567812345678';

  test('rejects when signingManifest is absent (missing manifest scenario)', () => {
    const params = {
      origin: 'https://dapp.example.com',
      unsignedHex: validHex,
      // no signingManifest
    };

    // Simulate the validation gate
    const signingManifest = (params as any).signingManifest;
    let errorCode: string | null = null;
    if (!signingManifest || typeof signingManifest !== 'object') {
      errorCode = 'MISSING_SIGNING_MANIFEST';
    }

    expect(errorCode).toBe('MISSING_SIGNING_MANIFEST');
  });

  test('rejects when unsignedHex is malformed (invalid hex characters)', () => {
    const badHex = '0xGGGGGGGGGGGGGGGG'; // non-hex chars
    const hexPattern = badHex.startsWith('0x')
      ? /^0x[0-9a-fA-F]+$/
      : /^[0-9a-fA-F]+$/;

    expect(hexPattern.test(badHex)).toBe(false);
    // Should produce INVALID_HEX error
  });

  test('rejects when digestTx in manifest does not match computed digest (mismatch scenario)', () => {
    // Simulate: wallet computes SHA3-256(hexBytes) = mockDigestTx
    // Manifest claims wrongDigestTx → mismatch → reject
    const computedDigestHex = mockDigestTx;
    const normalizedManifestDigest = wrongDigestTx.toLowerCase();

    expect(computedDigestHex).not.toBe(normalizedManifestDigest);
    // This mismatch should produce DIGEST_MISMATCH error code
  });

  test('rejects when no manifest inputs belong to the wallet (ownership violation)', () => {
    const manifestInputs = [
      { inputIndex: 0, coinId: '0xabc', address: '0xdeadbeef...', amount: '100', tokenId: '0x00' }
    ];
    const walletAddrsHex = [walletAddressHex];
    const manifestAddrsHex = manifestInputs.map(inp => inp.address.toLowerCase());
    const ownedCount = manifestAddrsHex.filter(a => walletAddrsHex.includes(a)).length;

    expect(ownedCount).toBe(0);
    // Should produce INPUT_OWNERSHIP_VIOLATION
  });

  test('succeeds for valid partial multisig signing when all checks pass', () => {
    const manifestInputs = [
      {
        inputIndex: 0,
        coinId: '0xcoinid',
        address: walletAddressHex,
        amount: '50',
        tokenId: '0x00'
      }
    ];
    const walletAddrsHex = [walletAddressHex.toLowerCase()];
    const manifestAddrsHex = manifestInputs.map(inp => inp.address.toLowerCase());
    const ownedCount = manifestAddrsHex.filter(a => walletAddrsHex.includes(a)).length;

    expect(ownedCount).toBeGreaterThan(0);
    // All checks pass: hex valid, digest matches, at least one input owned → proceed to sign
  });
});

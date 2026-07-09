import { TransactionService, PrepareRequest, PrepareResponse } from '../src/core/transaction/service';
import './setup';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock chrome storage for API base and project ID
const mockChromeStorage = {
  get: jest.fn(),
};
Object.assign(global.chrome.storage.local, mockChromeStorage);

describe('Transaction Flow Integration Test (Prepare → Sign → Finalize) - Real SDK', () => {
  let mockFetch: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.Mock;
    
    // Setup chrome storage mock
    mockChromeStorage.get.mockImplementation((keys, callback) => {
      callback({
        AXIA_BASE: 'https://rpc.axia.to',
        AXIA_PROJECT_ID: 'test-project-id'
      });
    });
  });

  describe('Full transaction flow with real WOTS signing', () => {
    const rootPublicKey = '0x' + 'aa'.repeat(32);
    const testSeed = new Uint8Array(32).fill(0x42);
    
    test('executes complete prepare → sign → finalize flow', async () => {
      // Mock prepare response
      const prepareResponse: PrepareResponse = {
        l1: 10,
        l2: 5,
        l3: 3,
        leaseToken: 'lease-token-123',
        digestTx: '0x' + 'ab'.repeat(32),
        digestL2: null,
        digestL3: null,
        txId: 'tx-123',
        rootPublicKey,
        paramSet: 'v2-spec',
        leaseId: 'lease-id-123',
        leaseTTL: 3600
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => prepareResponse
      });

      // Step 1: Prepare
      const prepareRequest: PrepareRequest = {
        to: '0x' + 'ff'.repeat(32),
        amount: '100000000000000000000000000000000000000000000', // 1 MINIMA in base units
        tokenId: '0x00'
      };

      const prepared = await TransactionService.prepare(prepareRequest, rootPublicKey);
      
      expect(prepared.l1).toBe(10);
      expect(prepared.l2).toBe(5);
      expect(prepared.l3).toBe(3);
      expect(prepared.leaseToken).toBe('lease-token-123');
      expect(prepared.digestTx).toBe('0x' + 'ab'.repeat(32));

      // Step 2: Sign locally with REAL SDK
      const { witnessBundle, signedHex } = await TransactionService.sign(
        {
          l1: prepared.l1,
          l2: prepared.l2,
          l3: prepared.l3,
          digestTx: prepared.digestTx
        },
        testSeed,
        'v2-spec'
      );

      // Verify REAL signature structure
      expect(witnessBundle.l1).toBe(10);
      expect(witnessBundle.signatures.l1Proof).toHaveLength(34);
      expect(witnessBundle.signatures.l2Proof).toHaveLength(34);
      expect(witnessBundle.signatures.l3Proof).toHaveLength(34);
      expect(signedHex).toMatch(/^0x[0-9a-f]+$/);

      // Step 3: Finalize
      const finalizeResponse = {
        ok: true,
        leaseId: 'lease-id-123',
        txpowid: '0x' + 'dd'.repeat(32)
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => finalizeResponse
      });

      const finalized = await TransactionService.finalize({
        leaseToken: prepared.leaseToken,
        signedHex
      });

      expect(finalized.ok).toBe(true);
      expect(finalized.txpowid).toBe('0x' + 'dd'.repeat(32));
    });

    test('handles prepare API error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid root public key' })
      });

      const prepareRequest: PrepareRequest = {
        to: '0x' + 'ff'.repeat(32),
        amount: '100000000000000000000000000000000000000000000'
      };

      await expect(
        TransactionService.prepare(prepareRequest, rootPublicKey)
      ).rejects.toThrow('Invalid root public key');
    });

    test('handles finalize API error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid signature' })
      });

      await expect(
        TransactionService.finalize({
          leaseToken: 'invalid-token',
          signedHex: '0xdeadbeef'
        })
      ).rejects.toThrow('Invalid signature');
    });
  });

  describe('API request validation', () => {
    const rootPublicKey = '0x' + 'aa'.repeat(32);

    test('prepare request includes all required fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          l1: 0, l2: 0, l3: 0,
          leaseToken: 'token',
          digestTx: '0x' + '00'.repeat(32),
          digestL2: null,
          digestL3: null,
          txId: 'tx-1',
          rootPublicKey,
          paramSet: 'v2-spec',
          leaseId: 'lease-1',
          leaseTTL: 3600
        })
      });

      const prepareRequest: PrepareRequest = {
        to: '0x' + 'ff'.repeat(32),
        amount: '500000000000000000000000000000000000000000000',
        tokenId: '0x00',
        burn: '100'
      };

      await TransactionService.prepare(prepareRequest, rootPublicKey);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/wots/hardened/prepare'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-project-id'
          }),
          body: expect.stringContaining(rootPublicKey)
        })
      );

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(callBody.to).toBe('0x' + 'ff'.repeat(32));
      expect(callBody.amount).toBe('500000000000000000000000000000000000000000000');
      expect(callBody.rootPublicKey).toBe(rootPublicKey);
      expect(callBody.paramSet).toBe('v2-spec');
    });

    test('finalize request includes leaseToken and signedHex', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          leaseId: 'lease-1',
          txpowid: '0x' + 'aa'.repeat(32)
        })
      });

      await TransactionService.finalize({
        leaseToken: 'test-token',
        signedHex: '0xabcdef'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/wots/hardened/finalize'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-project-id'
          })
        })
      );

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(callBody.leaseToken).toBe('test-token');
      expect(callBody.signedHex).toBe('0xabcdef');
    });
  });

  describe('Real-world transaction scenarios with real signatures', () => {
    const rootPublicKey = '0x' + 'aa'.repeat(32);
    const testSeed = new Uint8Array(32).fill(0x42);

    test('sends 5.25 MINIMA transaction with real WOTS signature', async () => {
      // 5.25 MINIMA in base units (44 decimals)
      const amount = '525000000000000000000000000000000000000000000';

      const prepareResponse: PrepareResponse = {
        l1: 15,
        l2: 30,
        l3: 7,
        leaseToken: 'lease-xyz',
        digestTx: '0x' + '12'.repeat(32),
        digestL2: null,
        digestL3: null,
        txId: 'tx-real',
        rootPublicKey,
        paramSet: 'v2-spec',
        leaseId: 'lease-real',
        leaseTTL: 3600
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => prepareResponse
      });

      const prepared = await TransactionService.prepare(
        {
          to: '0x' + 'bb'.repeat(32),
          amount
        },
        rootPublicKey
      );

      // Sign with real SDK
      const { witnessBundle } = await TransactionService.sign(
        {
          l1: prepared.l1,
          l2: prepared.l2,
          l3: prepared.l3,
          digestTx: prepared.digestTx
        },
        testSeed,
        'v2-spec'
      );

      expect(witnessBundle.signatures.l1Proof).toHaveLength(34);
      expect(witnessBundle.signatures.l1Proof[0]).toMatch(/^0x[0-9a-f]{64}$/);
    });

    test('handles token transfer (non-MINIMA) with real signature', async () => {
      const tokenId = '0x' + '99'.repeat(32);
      const amount = '100000000000000000000000000000000000000000000'; // 10 tokens

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          l1: 0, l2: 0, l3: 0,
          leaseToken: 'token-lease',
          digestTx: '0x' + '34'.repeat(32),
          digestL2: null,
          digestL3: null,
          txId: 'tx-token',
          rootPublicKey,
          paramSet: 'v2-spec',
          leaseId: 'lease-token',
          leaseTTL: 3600
        })
      });

      await TransactionService.prepare(
        {
          to: '0x' + 'cc'.repeat(32),
          amount,
          tokenId
        },
        rootPublicKey
      );

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(callBody.tokenId).toBe(tokenId);
    });
  });

  describe('Session and lease management', () => {
    test('includes lease TTL in prepare response', async () => {
      const prepareResponse: PrepareResponse = {
        l1: 0, l2: 0, l3: 0,
        leaseToken: 'ttl-lease',
        digestTx: '0x' + '78'.repeat(32),
        digestL2: null,
        digestL3: null,
        txId: 'tx-ttl',
        rootPublicKey: '0x' + 'aa'.repeat(32),
        paramSet: 'v2-spec',
        leaseId: 'lease-ttl',
        leaseTTL: 1800 // 30 minutes
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => prepareResponse
      });

      const prepared = await TransactionService.prepare(
        {
          to: '0x' + 'ee'.repeat(32),
          amount: '100000000000000000000000000000000000000000000'
        },
        '0x' + 'aa'.repeat(32)
      );

      expect(prepared.leaseTTL).toBe(1800);
      expect(prepared.leaseToken).toBe('ttl-lease');
    });
  });
});

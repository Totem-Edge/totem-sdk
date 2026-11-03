import { createPerAddressTreeKey } from '@totemsdk/core';
import { TransactionService, PrepareRequest, PrepareResponse } from '../src/core/transaction/service';
import './setup';

// Force the Axia REST backend; the Hawk backend is covered by
// hawk-transaction.test.ts.
jest.mock('../src/core/providers/activeNode', () => ({
  isHawkTransactionMode: jest.fn().mockResolvedValue(false),
  resolveActiveNodeRpc: jest.fn().mockResolvedValue(null),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

const TEST_SEED = new Uint8Array(32).fill(0x42);

describe('Transaction Flow Integration Test (Prepare → Sign → Finalize) - Real SDK', () => {
  let mockFetch: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.Mock;

    // getApiBase()/getProjectId() read through the typed-storage bridge.
    (chrome.storage.local as any).getTyped = jest.fn().mockResolvedValue({
      AXIA_BASE: 'https://rpc.axia.to',
      AXIA_BYPASS_BASE: 'https://api2.axia.to',
      AXIA_PROJECT_ID: 'test-project-id',
    });
  });

  describe('Full transaction flow with real WOTS signing', () => {
    const rootPublicKey = '0x' + 'aa'.repeat(32);

    test('executes complete prepare → sign → finalize flow', async () => {
      const prepareResponse: PrepareResponse = {
        addressIndex: 2,
        l1: 10,
        l2: 5,
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
        tokenId: '0x00',
        addressIndex: 2,
      };

      const prepared = await TransactionService.prepare(prepareRequest, rootPublicKey);

      expect(prepared.addressIndex).toBe(2);
      expect(prepared.l1).toBe(10);
      expect(prepared.l2).toBe(5);
      expect(prepared.leaseToken).toBe('lease-token-123');
      expect(prepared.digestTx).toBe('0x' + 'ab'.repeat(32));

      // Step 2: Sign locally with REAL SDK using the per-address TreeKey
      const { witnessBundle, signedHex } = await TransactionService.signWithPerAddressTreeKey(
        {
          addressIndex: prepared.addressIndex,
          l1: prepared.l1,
          l2: prepared.l2,
          digestTx: prepared.digestTx,
        },
        createPerAddressTreeKey(TEST_SEED, prepared.addressIndex),
      );

      // Verify REAL signature structure (Root → L1 → L2 → DATA)
      expect(witnessBundle.addressIndex).toBe(2);
      expect(witnessBundle.l1).toBe(10);
      expect(witnessBundle.l2).toBe(5);
      expect(witnessBundle.proofs).toHaveLength(3);
      expect(witnessBundle.proofs[0].leafPubkey).toMatch(/^0x[0-9a-f]{64}$/);
      expect(witnessBundle.proofs[1].leafPubkey).toMatch(/^0x[0-9a-f]{64}$/);
      expect(witnessBundle.proofs[2].leafPubkey).toMatch(/^0x[0-9a-f]{64}$/);
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
        amount: '100000000000000000000000000000000000000000000',
        addressIndex: 0,
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
          addressIndex: 0,
          l1: 0,
          l2: 0,
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
        burn: '100',
        addressIndex: 0,
      };

      await TransactionService.prepare(prepareRequest, rootPublicKey);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/wots-hardened/prepare'),
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
      expect(callBody.addressIndex).toBe(0);
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
        expect.stringContaining('/wots-hardened/finalize'),
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

    test('sends 5.25 MINIMA transaction with real WOTS signature', async () => {
      // 5.25 MINIMA in base units (44 decimals)
      const amount = '525000000000000000000000000000000000000000000';

      const prepareResponse: PrepareResponse = {
        addressIndex: 5,
        l1: 15,
        l2: 30,
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
          amount,
          addressIndex: 5,
        },
        rootPublicKey
      );

      // Sign with real SDK
      const { witnessBundle } = await TransactionService.signWithPerAddressTreeKey(
        {
          addressIndex: prepared.addressIndex,
          l1: prepared.l1,
          l2: prepared.l2,
          digestTx: prepared.digestTx,
        },
        createPerAddressTreeKey(TEST_SEED, prepared.addressIndex),
      );

      expect(witnessBundle.proofs).toHaveLength(3);
      expect(witnessBundle.proofs[0].signature).toHaveLength(2 + 34 * 32 * 2);
    });

    test('handles token transfer (non-MINIMA) with real signature', async () => {
      const tokenId = '0x' + '99'.repeat(32);
      const amount = '100000000000000000000000000000000000000000000'; // 10 tokens

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          addressIndex: 1,
          l1: 0,
          l2: 0,
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
          tokenId,
          addressIndex: 1,
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
        addressIndex: 0,
        l1: 0,
        l2: 0,
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
          amount: '100000000000000000000000000000000000000000000',
          addressIndex: 0,
        },
        '0x' + 'aa'.repeat(32)
      );

      expect(prepared.leaseTTL).toBe(1800);
      expect(prepared.leaseToken).toBe('ttl-lease');
    });
  });
});

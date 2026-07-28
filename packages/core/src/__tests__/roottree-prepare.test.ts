/**
 * TransactionService.prepare() — request propagation tests
 *
 * Verifies that prepare() correctly sends the required fields to the
 * /prepare endpoint. With the unified key derivation scheme, walletMode
 * and perAddressPublicKey are no longer part of the request body.
 */

import { TransactionService } from '../tx/TransactionService.js';
import type { TransactionServiceConfig } from '../tx/TransactionService.js';
import type { HttpClient } from '../adapters/index.js';

function makeMockHttp(capturedBodies: any[]): HttpClient {
  return {
    post: async <T>(_url: string, body: any): Promise<any> => {
      capturedBodies.push({ body });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {
          addressIndex: 0,
          l1: 0,
          l2: 0,
          leaseToken: 'mock-lease-token',
          digestTx: '0x' + 'ab'.repeat(32),
          digestL2: null,
          digestL3: null,
          txId: 'tx-mock',
          rootPublicKey: '0x' + 'ff'.repeat(32),
          paramSet: 'v2-spec',
          leaseId: 'lease-mock',
          leaseTTL: 120000,
        } as T,
      };
    },
    get: async <T>(): Promise<any> => ({
      ok: true, status: 200, statusText: 'OK', headers: {}, data: {} as T,
    }),
    put: async <T>(): Promise<any> => ({
      ok: true, status: 200, statusText: 'OK', headers: {}, data: {} as T,
    }),
    delete: async <T>(): Promise<any> => ({
      ok: true, status: 200, statusText: 'OK', headers: {}, data: {} as T,
    }),
  };
}

const config: TransactionServiceConfig = {
  baseUrl: 'https://api.example.com',
  apiKey: 'test-api-key',
  paramSet: 'v2-spec',
};

const MOCK_ROOT_PK = '0x' + 'aa'.repeat(32);

describe('TransactionService.prepare() — request shape', () => {
  it('sends required fields: addressIndex, rootPublicKey, paramSet', async () => {
    const bodies: any[] = [];
    const svc = new TransactionService(makeMockHttp(bodies), config);

    await svc.prepare(
      { to: 'MxABC', amount: '1', addressIndex: 0 },
      MOCK_ROOT_PK
    );

    expect(bodies).toHaveLength(1);
    const sent = bodies[0].body;
    expect(sent.addressIndex).toBe(0);
    expect(sent.rootPublicKey).toBe(MOCK_ROOT_PK);
    expect(sent.paramSet).toBe('v2-spec');
    expect(sent.to).toBe('MxABC');
    expect(sent.amount).toBe('1');
  });

  it('does not send walletMode or perAddressPublicKey (unified derivation)', async () => {
    const bodies: any[] = [];
    const svc = new TransactionService(makeMockHttp(bodies), config);

    await svc.prepare(
      { to: 'MxABC', amount: '1', addressIndex: 0 },
      MOCK_ROOT_PK
    );

    expect(bodies).toHaveLength(1);
    const sent = bodies[0].body;
    expect('walletMode' in sent).toBe(false);
    expect('perAddressPublicKey' in sent).toBe(false);
  });

  it('rejects missing addressIndex', async () => {
    const bodies: any[] = [];
    const svc = new TransactionService(makeMockHttp(bodies), config);
    await expect(svc.prepare({ to: 'MxABC', amount: '1' }, MOCK_ROOT_PK))
      .rejects.toThrow('addressIndex');
  });

  it('rejects addressIndex outside 0-63', async () => {
    const bodies: any[] = [];
    const svc = new TransactionService(makeMockHttp(bodies), config);
    await expect(svc.prepare({ to: 'MxABC', amount: '1', addressIndex: 64 }, MOCK_ROOT_PK))
      .rejects.toThrow('addressIndex');
  });
});

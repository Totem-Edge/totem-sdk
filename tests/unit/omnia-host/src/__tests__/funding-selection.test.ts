/**
 * OMN-036 — automatic channel funding selection is a decimal-MINIMA boundary.
 *
 * `selectFundingCoin` holds the target in atoms. Passing it straight to
 * `CoinSelectionService`, which parses decimal MINIMA, made a 0.2 MINIMA target
 * look like ~2e43 MINIMA and failed with a false insufficient-funds error.
 */

import { amountToAtoms } from '@totemsdk/core';
import { _resetChannelWatermarks } from '@totemsdk/omnia';
import { createHostMethods } from '../api/methods.js';
import { InProcessRoutingProvider } from '../router/routing-provider.js';

const ALICE = '0x' + 'aa'.repeat(32);
const FUNDING_ADDRESS = 'Mx' + 'ff'.repeat(20);

function operationStore() {
  const records = new Map<string, any>();
  return {
    get: (id: string) => records.get(id),
    create: (id: string, request?: unknown) => {
      const record = { operationId: id, status: 'pending', request };
      records.set(id, record);
      return record;
    },
    transition: (id: string, _from: string, to: string, patch?: any) => {
      const record = records.get(id);
      record.status = to;
      record.result = patch?.result;
      record.error = patch?.error;
      return record;
    },
    listByStatus: () => [],
  };
}

function context(coins: Array<{ coinid: string; amount: string }>) {
  const signer = {
    publicKeyDigest: ALICE,
    sign: jest.fn(async () => new Uint8Array(1088)),
  };
  const leaseProvider = {
    reserveKeyUse: jest.fn(async () => ({
      reservationId: 'lease-1',
      indices: { addressIndex: 0, l1: 0, l2: 0 },
      expiresAt: Date.now() + 1000,
    })),
    commitKeyUse: jest.fn(async () => undefined),
    burnReservation: jest.fn(async () => undefined),
  } as any;
  const getCoins = jest.fn(async () => coins.map((c) => ({
    ...c,
    address: FUNDING_ADDRESS,
    tokenid: '0x00',
    spent: false,
  })));
  return {
    context: {
      channels: new Map<string, any>(),
      operations: operationStore() as any,
      routing: new InProcessRoutingProvider(),
      signer,
      leaseProvider,
      fundingAddress: FUNDING_ADDRESS,
      localParticipant: {
        partyId: 'alice',
        publicKeyDigest: ALICE,
        addressIndex: 0,
        settlementAddress: FUNDING_ADDRESS,
      },
      chainProvider: {
        getCoins,
        getAddressInfo: async () => ({ publickey: '0x' + '01'.repeat(32), script: 'RETURN TRUE' }),
        exportCoin: async (coinId: string) => ({ coinId, data: '0x' + '02'.repeat(10) }),
        broadcastTxPoW: jest.fn(),
      } as any,
    },
    getCoins,
  };
}

const OPEN = {
  operationalId: 'open-1',
  remotePartyId: 'bob',
  remotePublicKeyDigest: '0x' + 'bb'.repeat(32),
  remoteAddressIndex: 1,
  remoteSettlementAddress: '0x' + '55'.repeat(32),
};

describe('OMN-036 funding selection units', () => {
  beforeEach(() => {
    _resetChannelWatermarks();
  });

  it('selects a coin for a fractional MINIMA target instead of failing', async () => {
    const { context: ctx, getCoins } = context([{ coinid: '0x' + '11'.repeat(32), amount: '0.5' }]);
    const methods = createHostMethods(ctx);
    const open = methods.get('totem_omniaOpenChannel')!;

    let error: unknown;
    try {
      await open({ ...OPEN, operationId: 'open-frac', localAmount: '0.2', remoteAmount: '0' });
    } catch (err) {
      error = err;
    }
    expect(getCoins).toHaveBeenCalled();
    // The failure, when the rest of the opening flow cannot complete in a unit
    // test, must never be the funding selection.
    expect(String(error ?? '')).not.toMatch(/funding selection failed/);
  });

  it('reports multi-input funding explicitly instead of truncating', async () => {
    const { context: ctx } = context([
      { coinid: '0x' + '21'.repeat(32), amount: '0.1' },
      { coinid: '0x' + '22'.repeat(32), amount: '0.1' },
    ]);
    const methods = createHostMethods(ctx);
    await expect(methods.get('totem_omniaOpenChannel')!({
      ...OPEN,
      operationId: 'open-multi',
      localAmount: '0.15',
      remoteAmount: '0',
    })).rejects.toThrow(/multi-input funding is not supported/);
  });

  it('keeps the atom target exact at the selection boundary', () => {
    // Guards the conversion used by selectFundingCoin.
    expect(amountToAtoms('0.2')).toBe(2n * 10n ** 43n);
    expect(amountToAtoms('0.2')).toBeGreaterThan(amountToAtoms('0.1'));
  });
});

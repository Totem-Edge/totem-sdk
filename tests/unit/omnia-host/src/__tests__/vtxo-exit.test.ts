/**
 * Host VTXO exit RPCs (OMN-088 / OMN-089 regression).
 *
 * These handlers were broken by the omnia-vtxo API change and nothing in the
 * host suite exercised them, so `tsc` caught it instead. This pins the contract:
 * a draft reserves the VTXO and is idempotent, and completion requires verified
 * chain evidence.
 */
import { createHostMethods } from '../api/methods.js';
import type { HostApiContext } from '../api/methods.js';
import type { OmniaVtxo } from '@totemsdk/vtxo';

const NOW = 1_000_000;

function vtxo(): OmniaVtxo {
  return {
    vtxoId: '0x' + '11'.repeat(32),
    poolId: 'pool-1',
    owner: 'alice',
    amount: 50_000n,
    tokenId: '0x00',
    epoch: 1,
    status: 'active',
    proof: { root: '0x' + '22'.repeat(32), leaf: '' },
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  } as OmniaVtxo;
}

function context(overrides: Partial<HostApiContext> = {}): HostApiContext {
  const vtxos = new Map<string, OmniaVtxo>([[vtxo().vtxoId, vtxo()]]);
  return {
    channels: new Map(),
    vtxos,
    vtxoReceipts: new Map(),
    vtxoPools: new Map(),
    // These handlers do not sign; the coordinator surface registers them without
    // a local signer/lease provider.
    coordinator: true,
    ...overrides,
  } as unknown as HostApiContext;
}

describe('host VTXO exit RPCs', () => {
  it('initiates an exit, reserving the VTXO and returning the draft', async () => {
    const ctx = context();
    const methods = createHostMethods(ctx);

    const result = await methods.get('totem_omniaInitiateVtxoExit')!({
      vtxoId: vtxo().vtxoId,
      now: NOW,
    }) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.created).toBe(true);
    expect(ctx.vtxos!.get(vtxo().vtxoId)!.status).toBe('exiting');
    expect(ctx.vtxoReceipts!.size).toBe(1);
  });

  it('a second initiate returns the original draft instead of a competing one', async () => {
    const ctx = context();
    const methods = createHostMethods(ctx);

    const first = await methods.get('totem_omniaInitiateVtxoExit')!({
      vtxoId: vtxo().vtxoId,
      now: NOW,
    }) as Record<string, unknown>;
    const second = await methods.get('totem_omniaInitiateVtxoExit')!({
      vtxoId: vtxo().vtxoId,
      now: NOW + 10,
    }) as Record<string, unknown>;

    expect(second.created).toBe(false);
    expect((second.draft as { createdAt: number }).createdAt)
      .toBe((first.draft as { createdAt: number }).createdAt);
    expect(ctx.vtxoReceipts!.size).toBe(1);
  });

  it('refuses completion without a configured exit verifier', async () => {
    const ctx = context();
    const methods = createHostMethods(ctx);
    await methods.get('totem_omniaInitiateVtxoExit')!({ vtxoId: vtxo().vtxoId, now: NOW });

    await expect(methods.get('totem_omniaCompleteVtxoExit')!({
      vtxoId: vtxo().vtxoId,
      txpowId: 'abcd',
      now: NOW + 1,
    })).rejects.toThrow(/requires a configured exit verifier/);
  });

  it('completes only when the verifier confirms depth, owner, amount and token', async () => {
    const ctx = context({
      vtxoExitVerifier: async () => ({
        valid: true,
        owner: 'alice',
        amount: 50_000n,
        tokenId: '0x00',
        confirmations: 3,
        reason: undefined,
      }),
    } as never);
    const methods = createHostMethods(ctx);
    await methods.get('totem_omniaInitiateVtxoExit')!({ vtxoId: vtxo().vtxoId, now: NOW });

    const result = await methods.get('totem_omniaCompleteVtxoExit')!({
      vtxoId: vtxo().vtxoId,
      txpowId: 'abcd',
      confirmations: 2,
      now: NOW + 1,
    }) as Record<string, unknown>;

    expect(result.success).toBe(true);
    const updated = ctx.vtxos!.get(vtxo().vtxoId)!;
    expect(updated.status).toBe('exited');
    expect(updated.exitState).toBe('settled');
  });

  it('refuses a verifier verdict that pays the wrong owner', async () => {
    const ctx = context({
      vtxoExitVerifier: async () => ({
        valid: true,
        owner: 'mallory',
        amount: 50_000n,
        confirmations: 3,
      }),
    } as never);
    const methods = createHostMethods(ctx);
    await methods.get('totem_omniaInitiateVtxoExit')!({ vtxoId: vtxo().vtxoId, now: NOW });

    await expect(methods.get('totem_omniaCompleteVtxoExit')!({
      vtxoId: vtxo().vtxoId,
      txpowId: 'abcd',
    })).rejects.toThrow(/pays mallory/);
  });
});

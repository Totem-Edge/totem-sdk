/**
 * V1 owner-pool covenant: transfer by owner rotation, unilateral exit by the
 * committed owner. Real WOTS signatures over a fixed tx digest.
 */
import {
  bytesToHex,
  derivePKdigest,
  hexToBytes,
  wotsAddressData,
  wotsSign,
} from '@totemsdk/core';
import { evaluateScript } from '@totemsdk/kissvm';
import type { CoinData, OutputData, ScriptWitness, TxContext } from '@totemsdk/kissvm';
import {
  buildOwnerExitDraft,
  buildOwnerExitTransaction,
  buildOwnerPoolScript,
  buildOwnerPoolState,
  buildOwnerTransferDraft,
  buildOwnerTransferTransaction,
  ownerAddressFor,
} from '../owner-pool';

const seedA = new Uint8Array(32).fill(1);
const seedB = new Uint8Array(32).fill(2);
const pkA = '0x' + bytesToHex(derivePKdigest(seedA, 0));
const pkB = '0x' + bytesToHex(derivePKdigest(seedB, 0));
const addrA = ownerAddressFor(pkA);
const addrB = ownerAddressFor(pkB);
const poolAddr = '0x' + 'ab'.repeat(32);
const TX_DIGEST = new Uint8Array(32).fill(7);
const script = buildOwnerPoolScript();

const sigA = wotsSign(seedA, 0, TX_DIGEST);
const sigB = wotsSign(seedB, 0, TX_DIGEST);

const state = (ownerPk: string, ownerAddr: string, epoch: number) => ({
  100: '0x' + '11'.repeat(32),
  101: String(epoch),
  102: '100',
  103: ownerPk,
  104: ownerAddr,
});

const coin: CoinData = { amount: 1_000, tokenId: '0x00', coinId: '0xpool', address: poolAddr };

function ctx(overrides: Partial<TxContext> = {}): TxContext {
  return {
    block: 50,
    inputIndex: 0,
    inputs: [coin],
    outputs: [{ address: poolAddr, amount: 1_000, tokenId: '0x00', keepState: true }],
    state: state(pkB, addrB, 2),
    prevState: state(pkA, addrA, 1),
    txDigest: TX_DIGEST,
    ...overrides,
  };
}

function witness(pk: string, sig: Uint8Array): ScriptWitness {
  return { signatures: new Map([[pk.replace(/^0x/, '').toLowerCase(), sig]]) };
}

describe('V1 owner-pool covenant', () => {
  it('transfers to a new owner with the previous owner signature', () => {
    const result = evaluateScript(script, witness(pkA, sigA), ctx());
    expect(result.passed).toBe(true);
  });

  it('rejects a transfer signed only by the new owner', () => {
    expect(evaluateScript(script, witness(pkB, sigB), ctx()).passed).toBe(false);
  });

  it('rejects a transfer that changes address, amount or the immutable envelope', () => {
    expect(evaluateScript(script, witness(pkA, sigA), ctx({
      outputs: [{ address: '0x' + 'cd'.repeat(32), amount: 1_000, tokenId: '0x00', keepState: true }],
    })).passed).toBe(false);
    expect(evaluateScript(script, witness(pkA, sigA), ctx({
      outputs: [{ address: poolAddr, amount: 999, tokenId: '0x00', keepState: true }],
    })).passed).toBe(false);
    expect(evaluateScript(script, witness(pkA, sigA), ctx({
      state: { ...state(pkB, addrB, 2), 100: '0x' + '22'.repeat(32) },
    })).passed).toBe(false);
    expect(evaluateScript(script, witness(pkA, sigA), ctx({
      state: { ...state(pkB, addrB, 2), 102: '101' },
    })).passed).toBe(false);
  });

  it('rejects an epoch that does not advance', () => {
    expect(evaluateScript(script, witness(pkA, sigA), ctx({
      state: state(pkB, addrB, 1),
    })).passed).toBe(false);
  });

  it('lets the new owner exit unilaterally after the exit block', () => {
    const exitCtx = ctx({
      block: 101,
      state: {},
      prevState: state(pkB, addrB, 2),
      outputs: [{ address: addrB, amount: 1_000, tokenId: '0x00', keepState: false }],
    });
    expect(evaluateScript(script, witness(pkB, sigB), exitCtx).passed).toBe(true);
  });

  it('rejects an exit by the old owner or before the exit block', () => {
    const afterBlock = (pk: string, sig: Uint8Array) => ctx({
      block: 101,
      state: {},
      prevState: state(pkB, addrB, 2),
      outputs: [{ address: addrB, amount: 1_000, tokenId: '0x00', keepState: false }],
    });
    expect(evaluateScript(script, witness(pkA, sigA), afterBlock(pkA, sigA)).passed).toBe(false);

    const beforeBlock = ctx({
      block: 100,
      state: {},
      prevState: state(pkB, addrB, 2),
      outputs: [{ address: addrB, amount: 1_000, tokenId: '0x00', keepState: false }],
    });
    expect(evaluateScript(script, witness(pkB, sigB), beforeBlock).passed).toBe(false);
  });

  it('rejects an exit to a different address or amount', () => {
    const wrongAddr = ctx({
      block: 101,
      state: {},
      prevState: state(pkB, addrB, 2),
      outputs: [{ address: addrA, amount: 1_000, tokenId: '0x00', keepState: false }],
    });
    expect(evaluateScript(script, witness(pkB, sigB), wrongAddr).passed).toBe(false);

    const wrongAmount = ctx({
      block: 101,
      state: {},
      prevState: state(pkB, addrB, 2),
      outputs: [{ address: addrB, amount: 999, tokenId: '0x00', keepState: false }],
    });
    expect(evaluateScript(script, witness(pkB, sigB), wrongAmount).passed).toBe(false);
  });

  it('builds state variables that round-trip the owner commitment', () => {
    const values = buildOwnerPoolState({ root: '0x' + '11'.repeat(32), epoch: 1, exitBlock: 100, ownerPk: pkA, ownerAddr: addrA });
    expect(values.find((v) => v.port === 103)?.value).toBe(pkA);
    expect(values.find((v) => v.port === 104)?.value).toBe(addrA);
    expect(ownerAddressFor(pkA)).toBe(addrA);
  });
});

describe('V1 owner-pool transaction builders', () => {
  const coin = {
    coinId: '0x' + 'cc'.repeat(32),
    address: poolAddr,
    amount: 1_000n,
    tokenId: '0x00',
  };
  const from = { root: '0x' + '11'.repeat(32), epoch: 1, exitBlock: 100, ownerPk: pkA, ownerAddr: addrA };
  const to = { ...from, epoch: 2, ownerPk: pkB, ownerAddr: addrB };
  const deps = { signDigest: async () => new Uint8Array(1088).fill(1) };

  it('builds a transfer that keeps address/amount and rotates the owner', () => {
    const draft = buildOwnerTransferDraft({ coin, from, to });
    expect(draft.outputs).toHaveLength(1);
    expect(draft.outputs[0].address).toBe(poolAddr);
    expect(draft.outputs[0].amount).toBe(1_000n);
    expect(draft.outputs[0].storeState).toBe(true);
    expect(draft.stateVariables?.find((v) => v.port === 103)?.value).toBe(pkB);
    expect(draft.stateVariables?.find((v) => v.port === 101)?.value).toBe(2n);
  });

  it('rejects a transfer with a non-advancing epoch or mismatched owner address', () => {
    expect(() => buildOwnerTransferDraft({ coin, from, to: { ...to, epoch: 1 } })).toThrow(/epoch/);
    expect(() => buildOwnerTransferDraft({ coin, from, to: { ...to, ownerAddr: addrA } })).toThrow(/derived/);
  });

  it('builds an exit to the committed owner address with no state', () => {
    const draft = buildOwnerExitDraft({ coin, state: to });
    expect(draft.outputs).toHaveLength(1);
    expect(draft.outputs[0].address).toBe(addrB);
    expect(draft.outputs[0].amount).toBe(1_000n);
    expect(draft.outputs[0].storeState).toBe(false);
  });

  it('assembles signed transfer and exit transactions', async () => {
    const transfer = await buildOwnerTransferTransaction({ coin, from, to }, deps);
    expect(transfer.kind).toBe('owner-transfer');
    expect(transfer.txHex.length).toBeGreaterThan(10);
    expect(transfer.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(transfer.witnessHex.length).toBeGreaterThan(10);

    const exit = await buildOwnerExitTransaction({ coin, state: to }, deps);
    expect(exit.kind).toBe('owner-exit');
    expect(exit.state.ownerAddr).toBe(addrB);
  });
});

describe('V1 owner-pool end-to-end (VM)', () => {
  const from = { root: '0x' + '11'.repeat(32), epoch: 1, exitBlock: 100, ownerPk: pkA, ownerAddr: addrA };
  const to = { ...from, epoch: 2, ownerPk: pkB, ownerAddr: addrB };
  const coin = {
    coinId: '0x' + 'cc'.repeat(32),
    address: poolAddr,
    amount: 1_000n,
    tokenId: '0x00',
  };

  const stateMap = (values: { port: number; value: unknown }[]) =>
    Object.fromEntries(values.map((v) => [v.port, String(v.value)]));

  it('verifies the actual signed transfer transaction, then Bob exits', async () => {
    const transfer = await buildOwnerTransferTransaction({ coin, from, to }, {
      signDigest: async (digest) => wotsSign(seedA, 0, digest),
    });
    const draft = buildOwnerTransferDraft({ coin, from, to });
    const transferCtx: TxContext = {
      block: 50,
      inputIndex: 0,
      inputs: [coin as unknown as CoinData],
      outputs: draft.outputs.map((o) => ({
        address: o.address,
        amount: Number(o.amount),
        tokenId: o.tokenId,
        keepState: o.storeState,
      })) as OutputData[],
      state: stateMap(draft.stateVariables ?? []),
      prevState: stateMap(buildOwnerPoolState(from)),
      txDigest: hexToBytes(transfer.digest),
    };
    expect(evaluateScript(script, witness(pkA, wotsSign(seedA, 0, hexToBytes(transfer.digest))), transferCtx).passed).toBe(true);
    expect(evaluateScript(script, witness(pkB, wotsSign(seedB, 0, hexToBytes(transfer.digest))), transferCtx).passed).toBe(false);

    const exit = await buildOwnerExitTransaction({ coin, state: to }, {
      signDigest: async (digest) => wotsSign(seedB, 0, digest),
    });
    const exitCtx: TxContext = {
      block: 101,
      inputIndex: 0,
      inputs: [coin as unknown as CoinData],
      outputs: [{ address: addrB, amount: 1_000, tokenId: '0x00', keepState: false }],
      state: {},
      prevState: stateMap(buildOwnerPoolState(to)),
      txDigest: hexToBytes(exit.digest),
    };
    expect(evaluateScript(script, witness(pkB, wotsSign(seedB, 0, hexToBytes(exit.digest))), exitCtx).passed).toBe(true);
    expect(evaluateScript(script, witness(pkA, wotsSign(seedA, 0, hexToBytes(exit.digest))), exitCtx).passed).toBe(false);
  });
});

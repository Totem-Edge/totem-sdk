import {
  buildTransaction,
  serializeWitness,
  serializeForTxnImport,
  buildScriptProof,
  scriptAddress,
  transactionSigningDigestHex,
  type WotsSignatureData,
} from '../../../packages/tx-builder/src/build';
import {
  buildHtlcClaim,
  buildHtlcRefund,
  buildHtlcFundingOutput,
} from '../../../packages/tx-builder/src/htlc';
import { assembleViaNode, type NodeAssemblyCommandClient } from '../../../packages/tx-builder/src/node-assembler';
import { computeScriptAddress, createSignedByDescriptor } from '@totemsdk/core';

const ADDRESS = '0x' + '11'.repeat(32);
const OTHER = '0x' + '22'.repeat(32);
const FEE = '0x' + '33'.repeat(32);
const COIN = '0x' + '44'.repeat(32);
const FEE_COIN = '0x' + '55'.repeat(32);
const PUB = '0x' + '66'.repeat(32);
const SCRIPT = `RETURN SIGNEDBY(${PUB.toUpperCase()})`;

function params() {
  return {
    inputs: [
      {
        coinId: COIN,
        address: ADDRESS,
        amount: '10',
        tokenId: '0x00',
        scriptDescriptor: createSignedByDescriptor(ADDRESS, PUB),
        coinProofHex: '0xdeadbeef',
      },
    ],
    outputs: [{ address: OTHER, amount: '9', tokenId: '0x00' }],
    transactionState: [{ port: 1, value: '0x' + '77'.repeat(32), type: 'hex' as const }],
  };
}

function wotsData(): WotsSignatureData {
  return {
    rootPublicKey: PUB,
    hierarchical: true,
    proofs: [
      {
        leafPubkey: '0x' + '88'.repeat(32),
        signature: '0x' + '99'.repeat(1088),
        mmrProof: '0x00',
      },
    ],
  };
}

describe('tx-builder P0', () => {
  test('builds a transaction and digest locally', () => {
    const built = buildTransaction(params());
    expect(built.transaction.inputs).toHaveLength(1);
    expect(built.transaction.outputs).toHaveLength(1);
    expect(built.transaction.state).toHaveLength(1);
    expect(built.serialized.length).toBeGreaterThan(0);
    expect(built.digestTxHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(transactionSigningDigestHex(params())).toBe(built.digestTxHex);
  });

  test('serializes all three witness sections', () => {
    const built = buildTransaction(params());
    const witness = serializeWitness(
      wotsData(),
      built.coinProofsHex,
      built.scriptDescriptors,
    );
    expect(witness.length).toBeGreaterThan(0);
    const txnRow = serializeForTxnImport('txn-1', built.transaction, witness);
    expect(txnRow.length).toBeGreaterThan(witness.length);
  });

  test('buildScriptProof and scriptAddress agree', () => {
    const proof = buildScriptProof(SCRIPT);
    expect(proof.length).toBeGreaterThan(0);
    expect(scriptAddress(SCRIPT)).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  test('HTLC claim carries preimage in transaction state, not input state', () => {
    const claim = buildHtlcClaim({
      funding: { coinId: COIN, address: ADDRESS, amount: '10', tokenId: '0x00' },
      fee: { coinId: FEE_COIN, address: FEE, amount: '1', tokenId: '0x00' },
      claimerAddress: OTHER,
      claimerPublicKey: PUB,
      feeChangeAddress: FEE,
      parties: {
        ownerPublicKey: PUB,
        recipientPublicKey: PUB,
        hashLock: '0x' + 'aa'.repeat(32),
        timeoutBlock: 100n,
      },
      preimage: '0x' + 'bb'.repeat(32),
    });
    expect((claim.inputs[0].scriptDescriptor as any).stateVariables).toBeUndefined();
    expect(claim.transactionState).toEqual([
      { port: 1, value: '0x' + 'bb'.repeat(32), type: 'hex' },
    ]);
  });

  test('HTLC funding output uses the canonical script address', () => {
    const funding = buildHtlcFundingOutput(
      {
        ownerPublicKey: PUB,
        recipientPublicKey: PUB,
        hashLock: '0x' + 'aa'.repeat(32),
        timeoutBlock: 100n,
      },
      '10',
    );
    expect(funding.address).toBe(computeScriptAddress(funding.script));
    expect(funding.output.address).toBe(funding.address);
    expect(funding.output).toMatchObject({ amount: '10', tokenId: undefined });
  });

  test('HTLC refund has no transaction state', () => {
    const refund = buildHtlcRefund({
      funding: { coinId: COIN, address: ADDRESS, amount: '10', tokenId: '0x00' },
      fee: { coinId: FEE_COIN, address: FEE, amount: '1', tokenId: '0x00' },
      refundAddress: OTHER,
      refundPublicKey: PUB,
      feeChangeAddress: FEE,
      parties: {
        ownerPublicKey: PUB,
        recipientPublicKey: PUB,
        hashLock: '0x' + 'aa'.repeat(32),
        timeoutBlock: 100n,
      },
    });
    expect(refund.transactionState).toBeUndefined();
  });

  test('assembleViaNode uses scriptmmr, txnstate, txnbasics and txnpost', async () => {
    const calls: Array<[string, unknown]> = [];
    const client: NodeAssemblyCommandClient = {
      async command(name, paramsArg) {
        calls.push([name, paramsArg]);
        if (name === 'txnpost') return { response: { txpowid: '0xabc' } };
        return { status: true };
      },
    };
    const result = await assembleViaNode(client, {
      inputs: [{ coinId: COIN, scriptmmr: true }],
      outputs: [{ address: OTHER, amount: '9', tokenId: '0x00' }],
      state: [{ port: 1, value: '0x' + 'bb'.repeat(32) }],
      txnId: 'txn-test',
    });
    expect(result.txpowid).toBe('0xabc');
    expect(calls.map(([name]) => name)).toEqual([
      'txncreate',
      'txninput',
      'txnoutput',
      'txnstate',
      'txnbasics',
      'txnpost',
      'txndelete',
    ]);
    expect(calls[1][1]).toMatchObject({ id: 'txn-test', coinid: COIN, scriptmmr: true });
  });
});

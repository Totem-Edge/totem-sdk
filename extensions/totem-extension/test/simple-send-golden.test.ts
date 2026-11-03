/**
 * Simple-send golden transaction.
 *
 * `test/goldens/simple-send.json` was captured from a Hawk node (0.2.6) with:
 *
 *   txncreate id:golden-simple-send
 *   txninput  id:golden-simple-send coindata:<fixture.coinData>
 *   txnoutput id:golden-simple-send amount:9 address:0x22…
 *   txnoutput id:golden-simple-send amount:1 address:0x11…
 *   txnexport id:golden-simple-send
 *
 * The node's transaction body and unsigned TxnRow are the expected bytes. A
 * simple send must now go through the canonical `@totemsdk/tx-builder` path
 * (SIMPLE_SCRIPT_TYPES is empty) so these bytes do not drift from the node.
 */

import { createSignedByDescriptor, serializeCoin, hexToBytes, bytesToHex } from '@totemsdk/core';
import {
  buildTransaction,
  serializeWitness,
  serializeForTxnImport,
} from '@totemsdk/tx-builder';
import { TransactionAssembler } from '../src/core/transaction/TransactionAssembler';
import fixture from './goldens/simple-send.json';
import './setup';

// The assembler pulls in minima-base32, which imports the ESM-only
// @noble/hashes package. Jest leaves it untransformed; this golden uses only
// 0x addresses, so a deterministic stub is sufficient.
jest.mock('@noble/hashes/sha3.js', () => {
  const sha3_256: any = (_data: Uint8Array) => new Uint8Array(32);
  sha3_256.arrayBuffer = (_data: Uint8Array) => new ArrayBuffer(32);
  return { sha3_256 };
});

function inputCoin() {
  return {
    coinId: hexToBytes(fixture.inputCoinId),
    address: hexToBytes(fixture.inputAddress),
    amount: fixture.inputAmount,
    tokenId: hexToBytes(fixture.tokenId),
    token: null,
    storeState: true,
    state: [],
    mmrEntryNumber: 0n,
    spent: false,
    created: 0n,
  };
}

function scriptDescriptor() {
  return {
    ...createSignedByDescriptor(fixture.inputAddress, fixture.wotsPublicKey),
    storeState: true,
  };
}

function buildGolden() {
  return buildTransaction({
    inputs: [
      {
        coinId: fixture.inputCoinId,
        address: fixture.inputAddress,
        amount: fixture.inputAmount,
        tokenId: fixture.tokenId,
        scriptDescriptor: scriptDescriptor(),
      },
    ],
    outputs: [
      {
        address: fixture.recipient,
        amount: fixture.sendAmount,
        tokenId: fixture.tokenId,
        storeState: true,
      },
      {
        address: fixture.inputAddress,
        amount: fixture.changeAmount,
        tokenId: fixture.tokenId,
        storeState: true,
      },
    ],
  });
}

describe('simple-send golden transaction', () => {
  test('coin serialization matches the node coindata', () => {
    expect('0x' + bytesToHex(serializeCoin(inputCoin()))).toBe(fixture.coinData);
  });

  test('transaction body and digest match the node byte-for-byte', () => {
    const built = buildGolden();

    expect(built.serializedHex.toLowerCase()).toBe(fixture.transactionHex.toLowerCase());
    expect(built.digestTxHex).toBe(fixture.digestTxHex);
  });

  test('unsigned TxnRow matches the node txnexport byte-for-byte', () => {
    const built = buildGolden();
    // `txninput` without `scriptmmr` / `txnscript` leaves the witness empty.
    const witness = serializeWitness(undefined, [], []);
    const txnRow = serializeForTxnImport(fixture.txId, built.transaction, witness);

    expect('0x' + bytesToHex(txnRow).toLowerCase()).toBe(
      fixture.unsignedTxnRowHex.toLowerCase(),
    );
  });

  test('the signed witness adds exactly one script proof section', () => {
    const built = buildGolden();
    const witness = serializeWitness(undefined, [], built.scriptDescriptors);

    expect(built.scriptDescriptors).toHaveLength(1);
    expect(built.scriptDescriptors[0].script).toBe(fixture.script);

    const emptyWitness = serializeWitness(undefined, [], []);
    expect(witness.length).toBeGreaterThan(emptyWitness.length);
  });

  test('TransactionAssembler routes simple_send through the canonical builder', async () => {
    const assembler = new TransactionAssembler();

    const coinSelection = {
      selectedCoins: [
        {
          coinId: fixture.inputCoinId,
          address: fixture.inputAddress,
          amount: fixture.inputAmount,
          tokenid: fixture.tokenId,
        },
      ],
      fromAddresses: [fixture.inputAddress],
      change: fixture.changeAmount,
      totalSelected: fixture.inputAmount,
      insufficientFunds: false,
    };

    const result = await (assembler as any).buildTransaction(
      {
        type: 'simple_send',
        recipient: fixture.recipient,
        amount: fixture.sendAmount,
        tokenId: fixture.tokenId,
        wotsRootPublicKey: fixture.wotsPublicKey,
        scriptDescriptor: scriptDescriptor(),
      },
      coinSelection,
    );

    // This is exactly the enhanced-builder parameter shape the assembler uses.
    // If simple_send fell back to the legacy builder the bytes would differ.
    const expected = buildTransaction({
      inputs: [
        {
          coinId: fixture.inputCoinId,
          address: fixture.inputAddress,
          amount: fixture.inputAmount,
          tokenId: fixture.tokenId,
          scriptDescriptor: scriptDescriptor(),
        },
      ],
      outputs: [
        { address: fixture.recipient, amount: fixture.sendAmount, tokenId: fixture.tokenId },
        { address: fixture.inputAddress, amount: fixture.changeAmount, tokenId: fixture.tokenId },
      ],
    });

    expect(result.result.serializedHex).toBe(expected.serializedHex);
    expect(result.result.digestTxHex).toBe(expected.digestTxHex);
  });
});

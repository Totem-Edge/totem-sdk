/**
 * Generate the simple-send golden transaction from the canonical builder.
 *
 * Usage:
 *   node scripts/gen-simple-send-golden.mjs
 *
 * The printed `coinData` can be fed to a Minima/Hawk node with
 * `txninput id:… coindata:<hex>`, then `txnoutput`/`txnexport` must produce the
 * same TxnRow bytes as `txnRow` below. This is the byte-for-byte node check
 * used by the extension's simple-send golden test.
 */

// The core package's transaction helpers call the async web wasm-bindgen
// build. Supply the bytes directly so this also runs under Node.
import { readFile } from 'node:fs/promises';
const wasmBytes = await readFile(
  new URL('../packages/core-wasm/pkg-web/totemsdk_core_wasm_bg.wasm', import.meta.url),
);
const { init } = await import('../packages/core/dist/wasm-async.js');
await init({ module_or_path: wasmBytes });

const {
  bytesToHex,
  hexToBytes,
  createSignedByDescriptor,
  serializeCoin,
} = await import('../packages/core/dist/index.js');
const {
  buildTransaction,
  serializeWitness,
  serializeForTxnImport,
} = await import('../packages/tx-builder/dist/index.js');

export const SIMPLE_SEND_GOLDEN = {
  txId: 'golden-simple-send',
  inputAddress: '0x' + '11'.repeat(32),
  recipient: '0x' + '22'.repeat(32),
  inputCoinId: '0x' + '44'.repeat(32),
  wotsPublicKey: '0x' + '66'.repeat(32),
  inputAmount: '10',
  sendAmount: '9',
  changeAmount: '1',
  tokenId: '0x00',
};

const g = SIMPLE_SEND_GOLDEN;

const inputCoin = {
  coinId: hexToBytes(g.inputCoinId),
  address: hexToBytes(g.inputAddress),
  amount: g.inputAmount,
  tokenId: hexToBytes(g.tokenId),
  token: null,
  storeState: true,
  state: [],
  mmrEntryNumber: 0n,
  spent: false,
  created: 0n,
};

const coinData = '0x' + bytesToHex(serializeCoin(inputCoin));

const scriptDescriptor = {
  ...createSignedByDescriptor(g.inputAddress, g.wotsPublicKey),
  storeState: true,
};

const built = buildTransaction({
  inputs: [
    {
      coinId: g.inputCoinId,
      address: g.inputAddress,
      amount: g.inputAmount,
      tokenId: g.tokenId,
      scriptDescriptor,
    },
  ],
  outputs: [
    { address: g.recipient, amount: g.sendAmount, tokenId: g.tokenId, storeState: true },
    { address: g.inputAddress, amount: g.changeAmount, tokenId: g.tokenId, storeState: true },
  ],
});

const emptyWitness = serializeWitness(undefined, [], built.scriptDescriptors);
const txnRow = '0x' + bytesToHex(serializeForTxnImport(g.txId, built.transaction, emptyWitness));

// The node's `txnexport` for a transaction with no scriptmmr/coinexport witness.
const unsignedWitness = serializeWitness(undefined, [], []);
const txnRowNoScripts = '0x' + bytesToHex(serializeForTxnImport(g.txId, built.transaction, unsignedWitness));

console.log(JSON.stringify({
  coinData,
  script: scriptDescriptor.script,
  serializedHex: built.serializedHex,
  digestTxHex: built.digestTxHex,
  txnRow,
  txnRowNoScripts,
}, null, 2));

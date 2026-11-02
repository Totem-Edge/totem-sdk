/**
 * @totemsdk/tx-builder/build
 *
 * Canonical Minima transaction + witness assembly.
 *
 * This is the edge-capable path: build the transaction locally, assemble the
 * complete witness (signatures, coin proofs, script proofs), serialize it for
 * `txnimport`, and sign the digest with a local signer. No node-side
 * `txncreate`/`txnbasics` is required.
 */

import {
  hexToBytes,
  concat,
  mxToHex,
  sha3_256,
  serializeRealMMRProof,
  writeMiniData,
  writeMiniNumber,
  writeMiniString,
  serializeTransactionObject as serializeTransaction,
  precomputeTransactionCoinID,
  type MinimaCoin,
  type MinimaTransaction,
  type StateVariable,
} from '@totemsdk/core';
import {
  deduplicateScriptDescriptors,
  serializeScriptProofWithProof,
  toNodeScript,
  computeScriptAddress,
  type ExternalSignature,
  type MMRProof,
  type ScriptDescriptor,
  type StateValue,
} from '@totemsdk/core/scripts';
import type { EnhancedBuildParams } from './enhanced-types.js';

export interface EnhancedBuildResult {
  transaction: MinimaTransaction;
  digestTx: Uint8Array;
  digestTxHex: string;
  serialized: Uint8Array;
  serializedHex: string;
  scriptDescriptors: ScriptDescriptor[];
  extraScripts: Map<string, string>;
  coinProofsHex: string[];
}

export interface WotsSignatureProofHex {
  leafPubkey: string;
  signature: string;
  mmrProof: string;
}

/**
 * Hierarchical per-address TreeKey signature data.
 *
 * `proofs` is the Root→L1→L2→DATA chain; each `mmrProof` is already serialized
 * in the Minima MMR proof wire format (the extension returns it that way).
 */
export interface WotsSignatureData {
  addressIndex?: number;
  l1?: number;
  l2?: number;
  rootPublicKey: string;
  hierarchical: boolean;
  proofs: WotsSignatureProofHex[];
}

export interface WitnessSections {
  signatures: Uint8Array;
  coinProofs: Uint8Array;
  scriptProofs: Uint8Array;
}

const MINIMA_TOKEN_ID = new Uint8Array([0x00]);
const ZERO_TXPOWID = new Uint8Array([0x00]);
const ZERO_HASH = new Uint8Array(32);

function addressBytes(address: string): Uint8Array {
  const hex = address.startsWith('Mx') || address.startsWith('mx') ? mxToHex(address) : address;
  const clean = hex.replace(/^0x/i, '');
  if (clean.length % 2 !== 0) throw new Error(`Invalid address hex: ${address}`);
  const bytes = hexToBytes(clean);
  const padded = new Uint8Array(32);
  padded.set(bytes.slice(0, 32));
  return padded;
}

function tokenIdBytes(tokenId?: string): Uint8Array {
  if (!tokenId) return MINIMA_TOKEN_ID;
  const clean = tokenId.replace(/^0x/i, '');
  return hexToBytes(clean);
}

function hex0x(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function stateValueToVariable(sv: StateValue): StateVariable {
  return { port: sv.port, value: sv.value, type: sv.type };
}

/**
 * Build a Minima transaction from enhanced inputs/outputs and transaction state.
 *
 * Amounts are decimal strings (Minima scale handled at serialization time), not
 * pre-scaled integers.
 */
export function buildTransaction(params: EnhancedBuildParams): EnhancedBuildResult {
  const { inputs, outputs, transactionState, linkHash } = params;
  if (!inputs || inputs.length === 0) throw new Error('No input coins provided');
  if (!outputs || outputs.length === 0) throw new Error('No output coins provided');

  const inputCoins: MinimaCoin[] = inputs.map((input) => ({
    coinId: (() => {
      const clean = input.coinId.replace(/^0x/i, '');
      const bytes = hexToBytes(clean);
      const padded = new Uint8Array(32);
      padded.set(bytes.slice(0, 32));
      return padded;
    })(),
    address: addressBytes(input.address),
    amount: input.amount || '0',
    tokenId: tokenIdBytes(input.tokenId),
    token: null,
    storeState: input.scriptDescriptor.storeState || false,
    state: (input.scriptDescriptor.stateVariables ?? []).map(stateValueToVariable),
    mmrEntryNumber: 0n,
    spent: false,
    created: 0n,
  }));

  const outputCoins: MinimaCoin[] = outputs.map((output) => ({
    coinId: ZERO_HASH,
    address: addressBytes(output.address),
    amount: output.amount || '0',
    tokenId: tokenIdBytes(output.tokenId),
    token: null,
    storeState: output.storeState || false,
    state: (output.state ?? []).map(stateValueToVariable),
    mmrEntryNumber: 0n,
    spent: false,
    created: 0n,
  }));

  const transaction: MinimaTransaction = {
    linkHash: linkHash || ZERO_TXPOWID,
    inputs: inputCoins,
    outputs: outputCoins,
    state: (transactionState ?? []).map(stateValueToVariable),
  };

  const scriptDescriptors = inputs.map((input) => input.scriptDescriptor);
  const extraScripts = new Map<string, string>();
  for (const descriptor of scriptDescriptors) {
    if (!descriptor.extraScripts) continue;
    for (const [script, proof] of descriptor.extraScripts) extraScripts.set(script, proof);
  }

  const coinProofsHex = inputs
    .map((input) => input.coinProofHex)
    .filter((proof): proof is string => Boolean(proof));

  // Java's txnpost/ txnsign path precomputes output coin IDs before the
  // transaction digest is signed. Without this the signer and the node hash
  // different bytes and the node reports SIGNATURE FAIL.
  precomputeTransactionCoinID(transaction);

  const serialized = serializeTransaction(transaction);
  const digestTx = sha3_256(serialized);

  return {
    transaction,
    digestTx,
    digestTxHex: hex0x(digestTx),
    serialized,
    serializedHex: hex0x(serialized),
    scriptDescriptors,
    extraScripts,
    coinProofsHex,
  };
}

function serializeSignatureProof(
  publicKey: Uint8Array,
  signature: Uint8Array,
  proof: MMRProof,
): Uint8Array {
  return concat(writeMiniData(publicKey), writeMiniData(signature), serializeRealMMRProof(proof));
}

function serializeSignature(signatureProofs: Uint8Array[]): Uint8Array {
  return concat(
    writeMiniNumber(BigInt(signatureProofs.length), 0),
    ...signatureProofs,
  );
}

function readMiniNumber(bytes: Uint8Array, offset: number): { value: bigint; bytesRead: number } {
  const length = (bytes[offset + 1] << 24) | (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 8) | bytes[offset + 4];
  if (length === 0) return { value: 0n, bytesRead: 5 };
  const data = bytes.slice(offset + 5, offset + 5 + length);
  let value = 0n;
  for (const b of data) value = (value << 8n) | BigInt(b);
  return { value, bytesRead: 5 + length };
}

function parseMMRProofHex(proofHex: string): MMRProof {
  const bytes = hexToBytes(proofHex);
  let offset = 0;
  const blockTime = readMiniNumber(bytes, offset);
  offset += blockTime.bytesRead;
  const chainLength = readMiniNumber(bytes, offset);
  offset += chainLength.bytesRead;
  const chunks = [];
  for (let i = 0; i < Number(chainLength.value); i += 1) {
    const isLeft = bytes[offset] === 1;
    offset += 1;
    const dataLength = (bytes[offset] << 24) | (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 4;
    const data = bytes.slice(offset, offset + dataLength);
    offset += dataLength;
    const value = readMiniNumber(bytes, offset);
    offset += value.bytesRead;
    chunks.push({ isLeft, mmrData: { data, value: value.value } });
  }
  return { chunks };
}

/**
 * Serialize the three Minima witness sections:
 *
 *   [Signature count][Signature…]
 *   [CoinProof count][CoinProof…]
 *   [ScriptProof count][ScriptProof…]
 *
 * `coinProofsHex` must be the serialized `coinexport` payload. Script proofs are
 * derived from each input's `ScriptDescriptor`; extra MAST scripts are appended.
 */
export function serializeWitness(
  wotsData: WotsSignatureData | undefined,
  coinProofsHex: string[],
  scriptDescriptors: ScriptDescriptor[],
  extraScripts?: Map<string, string>,
  externalSignatures?: ExternalSignature[],
): Uint8Array {
  const parts: Uint8Array[] = [];

  if (wotsData) {
    if (!wotsData.proofs || wotsData.proofs.length === 0) {
      throw new Error('WotsSignatureData requires a hierarchical proofs array');
    }
    const validExternal = (externalSignatures ?? []).filter((sig) => sig.validated);
    parts.push(writeMiniNumber(BigInt(1 + validExternal.length), 0));

    const signatureProofs = wotsData.proofs.map((proof) =>
      concat(
        writeMiniData(hexToBytes(proof.leafPubkey)),
        writeMiniData(hexToBytes(proof.signature)),
        hexToBytes(proof.mmrProof),
      ),
    );
    parts.push(serializeSignature(signatureProofs));

    for (const ext of validExternal) {
      parts.push(
        serializeSignature([
          serializeSignatureProof(
            hexToBytes(ext.publicKey),
            hexToBytes(ext.signature),
            ext.proof ?? { chunks: [] },
          ),
        ]),
      );
    }
  } else {
    parts.push(writeMiniNumber(0n, 0));
  }

  parts.push(writeMiniNumber(BigInt(coinProofsHex.length), 0));
  for (const proofHex of coinProofsHex) parts.push(hexToBytes(proofHex));

  const allScriptProofs: Uint8Array[] = [];
  for (const descriptor of deduplicateScriptDescriptors(scriptDescriptors).values()) {
    // The node derives the ScriptProof address from the script bytes. Use the
    // same canonical form used to derive the coin address.
    const canonical = toNodeScript(descriptor.script);
    allScriptProofs.push(
      serializeScriptProofWithProof(canonical, descriptor.mastProof ?? { chunks: [] }),
    );
  }
  if (extraScripts) {
    for (const [script, proofHex] of extraScripts) {
      allScriptProofs.push(
        serializeScriptProofWithProof(
          toNodeScript(script),
          proofHex ? parseMMRProofHex(proofHex) : { chunks: [] },
        ),
      );
    }
  }
  parts.push(writeMiniNumber(BigInt(allScriptProofs.length), 0));
  for (const proof of allScriptProofs) parts.push(proof);

  return concat(...parts);
}

/** Serialize a TxnRow for `txnimport`: MiniString(id) + Transaction + Witness. */
export function serializeForTxnImport(
  txId: string,
  transaction: MinimaTransaction,
  witness: Uint8Array,
): Uint8Array {
  return concat(writeMiniString(txId), serializeTransaction(transaction), witness);
}

/**
 * Build the canonical ScriptProof bytes for a single script (empty MMR proof).
 * This is the local equivalent of the node's `ScriptProof(script)` constructor
 * and of `txninput scriptmmr:true`.
 */
export function buildScriptProof(script: string): Uint8Array {
  return serializeScriptProofWithProof(toNodeScript(script), { chunks: [] });
}

/** Address (hex data) for a script, matching the node's `Address(script)`. */
export function scriptAddress(script: string): string {
  return computeScriptAddress(script);
}

/**
 * Compute the transaction digest a signer must sign.
 */
export function transactionSigningDigestHex(params: EnhancedBuildParams): string {
  return buildTransaction(params).digestTxHex;
}

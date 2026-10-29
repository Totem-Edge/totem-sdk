/**
 * Complex/scripted transaction assembly (TOTEM_SEND_COMPLEX).
 *
 * Uses the existing EnhancedTransactionBuilder and the per-address TreeKey
 * signing path. Works in both provider modes:
 *   - Hawk: proofs from the local node, finalize via node txnimport/txnpost.
 *   - Axia: prepare → /coinproofs → local sign → /finalize.
 *
 * Scope: one wallet-owned signing address per request (the connected spend
 * address). Inputs owned by other parties must carry
 * `scriptDescriptor.externalSignatures`, which are passed through to the
 * witness. Multiple distinct wallet-owned addresses are rejected explicitly
 * rather than producing an incomplete witness.
 */

import {
  buildEnhancedTransaction,
  serializeEnhancedForTxnImport,
  hexToBytes,
  type EnhancedBuildParams,
  type EnhancedCoinInput,
  type EnhancedCoinOutput,
} from './EnhancedTransactionBuilder';
import type { ExternalSignature } from './types/ScriptTypes';
import { TransactionService } from './service';
import { isHawkTransactionMode } from '../providers/activeNode';
import { walletManager } from '../wallet';

function toHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function strip0x(value: string): string {
  return value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
}

function ensure0x(value: string): string {
  if (!value) return value;
  return value.startsWith('0x') || value.startsWith('0X') ? value : `0x${value}`;
}

function proofHexFrom(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.data === 'string') return value.data;
    if (typeof value.coinProofHex === 'string') return value.coinProofHex;
    if (typeof value.proof === 'string') return value.proof;
  }
  return undefined;
}

function mapInput(input: any): EnhancedCoinInput {
  const descriptor = input?.scriptDescriptor ?? {};
  const address = ensure0x(input.address);
  const extraScripts =
    descriptor.extraScripts && !(descriptor.extraScripts instanceof Map)
      ? new Map<string, string>(Object.entries(descriptor.extraScripts as Record<string, string>))
      : descriptor.extraScripts;

  return {
    coinId: ensure0x(input.coinId),
    address,
    amount: String(input.amount),
    tokenId: ensure0x(input.tokenId || '0x00'),
    scriptDescriptor: {
      ...descriptor,
      address,
      ...(extraScripts ? { extraScripts } : {}),
    },
    ...(proofHexFrom(input.coinProof) ? { coinProofHex: strip0x(proofHexFrom(input.coinProof)!) } : {}),
  };
}

function mapOutput(output: any): EnhancedCoinOutput {
  return {
    address: ensure0x(output.address),
    amount: String(output.amount),
    tokenId: ensure0x(output.tokenId || '0x00'),
    ...(output.storeState !== undefined ? { storeState: output.storeState } : {}),
    ...(Array.isArray(output.state) ? { state: output.state } : {}),
  };
}

function toEnhancedParams(buildParams: any): EnhancedBuildParams {
  if (!buildParams || !Array.isArray(buildParams.inputs) || buildParams.inputs.length === 0) {
    throw new Error('buildParams.inputs must be a non-empty array');
  }
  if (!Array.isArray(buildParams.outputs) || buildParams.outputs.length === 0) {
    throw new Error('buildParams.outputs must be a non-empty array');
  }

  return {
    inputs: buildParams.inputs.map(mapInput),
    outputs: buildParams.outputs.map(mapOutput),
    ...(Array.isArray(buildParams.transactionState)
      ? { transactionState: buildParams.transactionState }
      : {}),
    ...(typeof buildParams.linkHash === 'string' && buildParams.linkHash.length > 0
      ? { linkHash: hexToBytes(buildParams.linkHash) }
      : {}),
  };
}

function externalSignaturesFrom(params: EnhancedBuildParams): ExternalSignature[] {
  const out: ExternalSignature[] = [];
  for (const input of params.inputs) {
    const raw = (input.scriptDescriptor as any)?.externalSignatures;
    if (!Array.isArray(raw)) continue;
    for (const sig of raw) {
      if (!sig || typeof sig.publicKey !== 'string' || typeof sig.signature !== 'string') continue;
      out.push({
        publicKey: sig.publicKey,
        signature: sig.signature,
        ...(sig.proof ? { proof: sig.proof } : {}),
        signatureType: sig.signatureType === 'standard' ? 'standard' : 'wots',
        // The SDK's validator is currently a structural stub; the node is the
        // final verifier. Only explicitly-shaped signatures are forwarded.
        validated: true,
      });
    }
  }
  return out;
}

function ownedAddressIndexFor(inputs: EnhancedCoinInput[]): number {
  const indices = new Set<number>();
  for (const input of inputs) {
    const index = walletManager.getAddressIndex(input.address);
    if (index !== null && index !== undefined) indices.add(index);
  }
  if (indices.size === 0) {
    throw new Error('None of the input addresses belong to this wallet');
  }
  if (indices.size > 1) {
    throw new Error(
      'Complex sends from multiple wallet addresses are not supported yet; sign per address with TOTEM_SIGN_DATA and broadcast',
    );
  }
  return [...indices][0];
}

function attachProofs(params: EnhancedBuildParams, proofs: string[]): void {
  params.inputs.forEach((input, index) => {
    if (!input.coinProofHex && proofs[index]) input.coinProofHex = strip0x(proofs[index]);
  });
}

export interface ComplexBuildResult {
  unsignedHex: string;
  digestTxHex: string;
  digestTx: string;
  changeOutput: null;
  fee: null;
  inputCoinProofs: Array<{
    coinId: string;
    amount: string;
    tokenId: string;
    address: string;
    proof: string | null;
  }>;
  scriptDescriptors: any[];
  coinProofsHex: string[];
}

/**
 * Build the unsigned transaction only. Consumes no WOTS keys or leases.
 */
export async function buildComplexUnsigned(buildParams: any): Promise<ComplexBuildResult> {
  const params = toEnhancedParams(buildParams);

  // Hawk can fetch proofs without a lease; Axia build mode relies on the
  // caller-provided `coinProof` because its proof endpoint is lease-scoped.
  if (await isHawkTransactionMode()) {
    const missing = params.inputs.filter((i) => !i.coinProofHex).map((i) => i.coinId);
    if (missing.length > 0) {
      const proofs = await TransactionService.fetchCoinProofs('', params.inputs.map((i) => i.coinId));
      attachProofs(params, proofs);
    }
  }

  const built = buildEnhancedTransaction(params);

  return {
    unsignedHex: toHex(built.serialized),
    digestTxHex: toHex(built.digestTx),
    digestTx: toHex(built.digestTx),
    changeOutput: null,
    fee: null,
    inputCoinProofs: params.inputs.map((input) => ({
      coinId: input.coinId,
      amount: String(input.amount),
      tokenId: input.tokenId || '0x00',
      address: input.address,
      proof: input.coinProofHex ? ensure0x(input.coinProofHex) : null,
    })),
    scriptDescriptors: params.inputs.map((i) => i.scriptDescriptor),
    coinProofsHex: built.coinProofsHex,
  };
}

export interface ComplexSendResult {
  success: true;
  mode: 'submit';
  txpowid: string;
  status: 'submitted';
  detectedIntent?: string;
  inputCount: number;
  outputCount: number;
}

/**
 * Build, sign (this wallet's inputs) and finalize a complex transaction.
 * External signatures supplied by the dApp are forwarded to the witness.
 */
export async function sendComplex(
  buildParams: any,
  detectedIntent?: string,
): Promise<ComplexSendResult> {
  const params = toEnhancedParams(buildParams);
  const addressIndex = ownedAddressIndexFor(params.inputs);

  const txId = `complex-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const prepared = await walletManager.requestLease({ txId, addressIndex });

  if (
    typeof prepared.addressIndex !== 'number' ||
    typeof prepared.l1 !== 'number' ||
    typeof prepared.l2 !== 'number' ||
    !prepared.leaseToken
  ) {
    throw new Error('Lease response is missing signing indices');
  }

  const proofs = await TransactionService.fetchCoinProofs(
    prepared.leaseToken,
    params.inputs.map((i) => i.coinId),
  );
  attachProofs(params, proofs);

  const built = buildEnhancedTransaction(params);

  const signed = await walletManager.signTransactionPerAddress({
    addressIndex: prepared.addressIndex,
    l1: prepared.l1,
    l2: prepared.l2,
    digestTx: built.digestTxHex,
  });
  if (!signed?.witnessBundle?.rootPublicKey) {
    throw new Error('Failed to sign complex transaction');
  }

  const wotsData = {
    addressIndex: signed.witnessBundle.addressIndex,
    l1: signed.witnessBundle.l1,
    l2: signed.witnessBundle.l2,
    hierarchical: true,
    proofs: signed.witnessBundle.proofs,
    rootPublicKey: signed.witnessBundle.rootPublicKey,
  };

  const importId = `totem-${prepared.leaseId || Date.now()}`;
  const txnImportBytes = serializeEnhancedForTxnImport(
    built.transaction,
    importId,
    wotsData,
    built.coinProofsHex,
    built.scriptDescriptors,
    built.extraScripts,
    externalSignaturesFrom(params),
  );
  const txnImportHex = toHex(txnImportBytes);

  const finalized = await walletManager.finalizeTransaction({
    leaseToken: prepared.leaseToken,
    signedHex: txnImportHex,
    importId,
  });
  if (!finalized?.txpowid) {
    throw new Error('Finalize returned no txpowid');
  }

  return {
    success: true,
    mode: 'submit',
    txpowid: finalized.txpowid,
    status: 'submitted',
    ...(detectedIntent ? { detectedIntent } : {}),
    inputCount: params.inputs.length,
    outputCount: params.outputs.length,
  };
}

/**
 * Prepared simple-send flow.
 *
 * The review screen must show the exact transaction that will be signed. This
 * module performs coin selection, lease acquisition, CoinProof fetch, token
 * metadata extraction and transaction construction once, then keeps that
 * prepared object in background memory until the user confirms. Confirmation
 * signs and submits those exact bytes; it never re-selects coins.
 */

import {
  coinSelectionService,
  addDecimalStrings,
  type CoinSelectionResult,
} from './CoinSelectionService';
import {
  buildTransaction,
  extractCoinDataFromCoinProof,
  serializeForTxnImport,
  bytesToHex,
  parseDecimalToBaseUnits,
  type BuildTransactionParams,
  type CoinProofData,
  type InputScriptInfo,
  type MinimaTransaction,
  type SpendableCoinInput,
  type TransactionBuildResult,
} from './MinimaTransactionBuilder';
import type { ScriptDescriptor, StateValue } from './types/ScriptTypes';
import { TransactionService } from './service';
import { walletManager } from '../wallet';
import { formatMinimaAmount, MINIMA_DECIMALS } from '../../constants';
import { hexToMx } from '../utils/minima-base32';

export interface PrepareSimpleSendParams {
  to: string;
  /** 44-decimal base units. */
  amount: string;
  tokenid?: string;
  tokenSymbol?: string;
  sourceAddress: string;
  /** Native-Minima burn, 44-decimal base units. */
  burn?: string;
  state?: StateValue[];
  storeState?: boolean;
  transactionState?: StateValue[];
}

export interface PreparedSendPreview {
  prepareId: string;
  sourceAddress: string;
  tokenid: string;
  rawTransactionHex: string;
  digestTxHex: string;
  inputs: Array<{
    coinId: string;
    address: string;
    amount: string;
    tokenId: string;
    scriptType: string;
    scriptDescription?: string;
  }>;
  outputs: Array<{
    address: string;
    amount: string;
    tokenId: string;
    isChange: boolean;
    stateVariables?: { port: number; value: string }[];
  }>;
  totalOut: { tokenId: string; amount: string }[];
  /** Minima-backing decimal amount of the recipient output (custom tokens). */
  sentTokenAmount: string;
  scriptDescriptors: ScriptDescriptor[];
  walletAddresses: string[];
}

interface PreparedSimpleSend {
  preview: PreparedSendPreview;
  leaseToken: string;
  leaseId: string;
  addressIndex: number;
  l1: number;
  l2: number;
  builderInputs: SpendableCoinInput[];
  coinProofsHex: string[];
  buildResult: TransactionBuildResult;
  importId: string;
  tokenid: string;
  tokenSymbol?: string;
  to: string;
  amountBaseUnits: string;
  burnBaseUnits: string;
}

const PREPARED_TTL_MS = 5 * 60 * 1000;
const prepared = new Map<string, { value: PreparedSimpleSend; createdAt: number }>();

function prunePrepared(): void {
  const now = Date.now();
  for (const [id, entry] of prepared) {
    if (now - entry.createdAt > PREPARED_TTL_MS) prepared.delete(id);
  }
}

function randomId(prefix: string): string {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return `${prefix}-${Date.now()}-${Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function displayAmountToMinimaDecimal(displayAmount: string, scale: number): string {
  const dotIdx = displayAmount.indexOf('.');
  const intPart = dotIdx >= 0 ? displayAmount.slice(0, dotIdx) : displayAmount;
  const fracPart = dotIdx >= 0 ? displayAmount.slice(dotIdx + 1) : '';
  const digits = (intPart + fracPart).replace(/^0+/, '') || '0';
  if (digits === '0') return '0';
  const totalScale = fracPart.length + scale;
  const digitLen = digits.length;
  if (totalScale >= digitLen) {
    return '0.' + '0'.repeat(totalScale - digitLen) + digits;
  }
  const beforeDot = digits.slice(0, digitLen - totalScale);
  const afterDot = digits.slice(digitLen - totalScale);
  return beforeDot + (afterDot ? '.' + afterDot : '');
}

function groupOutputs(transaction: MinimaTransaction): { totalOut: PreparedSendPreview['totalOut']; recipientBacking: string } {
  const totals = new Map<string, bigint>();
  for (const output of transaction.outputs) {
    const tokenId = bytesToHex(output.tokenId);
    const current = totals.get(tokenId) ?? 0n;
    totals.set(tokenId, current + parseDecimalToBaseUnits(output.amount));
  }

  return {
    totalOut: [...totals.entries()].map(([tokenId, amount]) => ({
      tokenId,
      amount: amount.toString(),
    })),
    recipientBacking: transaction.outputs[0]?.amount ?? '0',
  };
}

export async function prepareSimpleSend(params: PrepareSimpleSendParams): Promise<PreparedSendPreview> {
  prunePrepared();

  if (!params.to || !params.amount) throw new Error('Recipient and amount are required');
  if (!params.sourceAddress) throw new Error('sourceAddress is required');

  const tokenid = params.tokenid || '0x00';
  const amountDecimal = formatMinimaAmount(params.amount, MINIMA_DECIMALS);
  const burnBaseUnits = BigInt(params.burn || '0');
  if (burnBaseUnits > 0n && tokenid !== '0x00') {
    throw new Error('Burn is only supported for native Minima sends');
  }
  const burnDecimal = burnBaseUnits > 0n
    ? formatMinimaAmount(burnBaseUnits.toString(), MINIMA_DECIMALS)
    : '0';
  const targetAmount = burnBaseUnits > 0n
    ? addDecimalStrings(amountDecimal, burnDecimal)
    : amountDecimal;

  const selection = await coinSelectionService.selectCoinsForSend(params.sourceAddress, {
    targetAmount,
    tokenId: tokenid === '0x00' ? undefined : tokenid,
  });

  if (selection.insufficientFunds) {
    throw new Error(`Insufficient funds: need ${targetAmount}, have ${selection.totalSelected}`);
  }
  if (selection.selectedCoins.length === 0) throw new Error('No spendable coins found');
  if (selection.fromAddresses.length > 1) {
    throw new Error('Selected coins span multiple wallet addresses. A send must use only the selected address.');
  }

  const addressIndex = walletManager.getAddressIndex(params.sourceAddress);
  if (addressIndex === null || addressIndex === undefined) {
    throw new Error('Selected source address is not owned by this wallet');
  }

  const txId = randomId('prep');
  const prepareResult = await walletManager.requestLease({ txId, addressIndex });
  if (!prepareResult?.leaseToken) throw new Error('Failed to acquire WOTS lease');
  if (
    typeof prepareResult.addressIndex !== 'number' ||
    typeof prepareResult.l1 !== 'number' ||
    typeof prepareResult.l2 !== 'number'
  ) {
    throw new Error('Lease response is missing signing indices');
  }

  const coinIds = selection.selectedCoins.map(coin => coin.coinId);
  const coinProofsHex = await TransactionService.fetchCoinProofs(prepareResult.leaseToken, coinIds);

  const coinDataMap = new Map<string, CoinProofData>();
  const amountBytesMap = new Map<string, Uint8Array>();
  for (let i = 0; i < coinIds.length; i++) {
    const coinId = coinIds[i];
    const proofHex = coinProofsHex[i];
    if (!proofHex) throw new Error(`CoinProof missing for ${coinId}`);
    const coinData = extractCoinDataFromCoinProof(proofHex);
    if (!coinData) throw new Error(`Failed to decode CoinProof for ${coinId}`);
    coinDataMap.set(coinId, coinData);
    amountBytesMap.set(coinId, coinData.rawAmountBytes);
  }

  let sendAmount = amountDecimal;
  if (tokenid !== '0x00') {
    const firstCoinData = [...coinDataMap.values()][0];
    const tokenScale = firstCoinData?.tokenScale;
    if (tokenScale === undefined) {
      throw new Error('Cannot determine token scale from CoinProof');
    }
    if (![...coinDataMap.values()].some(cpd => cpd.rawTokenData && cpd.rawTokenData.length > 0)) {
      throw new Error('Cannot send token: failed to extract token metadata from CoinProof');
    }
    sendAmount = displayAmountToMinimaDecimal(amountDecimal, tokenScale);
  }

  const builderInputs: SpendableCoinInput[] = selection.selectedCoins.map(coin => ({
    coinId: coin.coinId,
    address: coin.address,
    amount: coin.amount,
    tokenId: coin.tokenid || '0x00',
    rawAmountBytes: amountBytesMap.get(coin.coinId),
    coinProofData: coinDataMap.get(coin.coinId),
  }));

  const buildParams: BuildTransactionParams = {
    inputs: builderInputs,
    recipientAddress: params.to,
    amount: sendAmount,
    tokenId: tokenid,
    changeAddress: params.sourceAddress,
    ...(burnBaseUnits > 0n ? { burn: burnDecimal } : {}),
    ...(Array.isArray(params.state) ? { state: params.state } : {}),
    ...(typeof params.storeState === 'boolean' ? { storeState: params.storeState } : {}),
    ...(Array.isArray(params.transactionState) ? { transactionState: params.transactionState } : {}),
  };

  const buildResult = buildTransaction(buildParams);
  const account = walletManager.getAccountByIndex(addressIndex);
  const publicKey = account?.publicKey || '';
  const scriptDescriptors: ScriptDescriptor[] = selection.selectedCoins.map(coin => ({
    scriptType: 'signedby',
    address: coin.address,
    script: `RETURN SIGNEDBY(${publicKey.toUpperCase().replace(/^0X/, '0x')})`,
    wotsRootPublicKey: publicKey,
  }));

  const walletAddressHex = new Set(
    walletManager.getAllAddresses().map(addr => {
      const mx = addr.startsWith('Mx') ? addr : hexToMx(addr);
      return mx.toLowerCase();
    }),
  );
  const recipientMx = params.to.startsWith('Mx') ? params.to : hexToMx(params.to);
  const { totalOut, recipientBacking } = groupOutputs(buildResult.transaction);

  const inputs = buildResult.transaction.inputs.map((input, index) => ({
    coinId: bytesToHex(input.coinId),
    address: bytesToHex(input.address),
    amount: input.amount,
    tokenId: bytesToHex(input.tokenId),
    scriptType: scriptDescriptors[index]?.scriptType || 'signedby',
    scriptDescription: scriptDescriptors[index]?.script,
  }));
  const outputs = buildResult.transaction.outputs.map(output => {
    const addressMx = hexToMx(bytesToHex(output.address));
    return {
      address: addressMx,
      amount: output.amount,
      tokenId: bytesToHex(output.tokenId),
      isChange: walletAddressHex.has(addressMx.toLowerCase()) && addressMx.toLowerCase() !== recipientMx.toLowerCase(),
      stateVariables: output.state.map(s => ({
        port: s.port,
        value: s.value instanceof Uint8Array
          ? bytesToHex(s.value)
          : typeof s.value === 'string'
            ? s.value
            : String(s.value),
      })),
    };
  });

  const prepareId = randomId('prepared');
  const preview: PreparedSendPreview = {
    prepareId,
    sourceAddress: params.sourceAddress,
    tokenid,
    rawTransactionHex: buildResult.serializedHex,
    digestTxHex: buildResult.digestTxHex,
    inputs,
    outputs,
    totalOut,
    sentTokenAmount: recipientBacking,
    scriptDescriptors,
    walletAddresses: [params.sourceAddress],
  };

  prepared.set(prepareId, {
    createdAt: Date.now(),
    value: {
      preview,
      leaseToken: prepareResult.leaseToken,
      leaseId: prepareResult.leaseId,
      addressIndex: prepareResult.addressIndex,
      l1: prepareResult.l1,
      l2: prepareResult.l2,
      builderInputs,
      coinProofsHex,
      buildResult,
      importId: `totem-${prepareResult.leaseId || Date.now()}`,
      tokenid,
      tokenSymbol: params.tokenSymbol,
      to: params.to,
      amountBaseUnits: params.amount,
      burnBaseUnits: burnBaseUnits.toString(),
    },
  });

  return preview;
}

export interface PreparedSendResult {
  txpowid: string;
  leaseId: string;
  addressIndex: number;
  l1: number;
  l2: number;
  tokenid: string;
  tokenSymbol?: string;
  to: string;
  sourceAddress: string;
  amountBaseUnits: string;
}

export async function sendPrepared(prepareId: string): Promise<PreparedSendResult> {
  const entry = prepared.get(prepareId);
  if (!entry) {
    throw new Error('Prepared transaction not found or expired. Please review the transaction again.');
  }
  prepared.delete(prepareId);

  const p = entry.value;
  const signed = await walletManager.signTransactionPerAddress({
    addressIndex: p.addressIndex,
    l1: p.l1,
    l2: p.l2,
    digestTx: p.buildResult.digestTxHex,
  });

  const witnessBundle = signed?.witnessBundle;
  if (!witnessBundle?.rootPublicKey || !Array.isArray(witnessBundle.proofs)) {
    throw new Error('Failed to sign prepared transaction');
  }

  // All inputs came from one selected address, so every ScriptProof uses the
  // same per-address TreeKey root that just signed the digest.
  const inputScripts: InputScriptInfo[] = p.builderInputs.map(input => ({
    address: input.address,
    rootPublicKey: witnessBundle.rootPublicKey,
  }));

  const wotsData = {
    addressIndex: witnessBundle.addressIndex,
    l1: witnessBundle.l1,
    l2: witnessBundle.l2,
    hierarchical: true,
    proofs: witnessBundle.proofs,
    rootPublicKey: witnessBundle.rootPublicKey,
  };

  const txnImportBytes = serializeForTxnImport(
    p.buildResult.transaction,
    p.importId,
    wotsData,
    p.coinProofsHex,
    inputScripts,
    p.buildResult.serialized,
  );
  const txnImportHex = '0x' + bytesToHex(txnImportBytes);

  const finalized = await walletManager.finalizeTransaction({
    leaseToken: p.leaseToken,
    signedHex: txnImportHex,
    importId: p.importId,
  });
  if (!finalized?.ok || !finalized.txpowid) {
    throw new Error('Failed to finalize prepared transaction');
  }

  return {
    txpowid: finalized.txpowid,
    leaseId: finalized.leaseId || p.leaseId,
    addressIndex: p.addressIndex,
    l1: p.l1,
    l2: p.l2,
    tokenid: p.tokenid,
    tokenSymbol: p.tokenSymbol,
    to: p.to,
    sourceAddress: p.preview.sourceAddress,
    amountBaseUnits: p.amountBaseUnits,
  };
}

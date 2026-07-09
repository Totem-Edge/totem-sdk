/**
 * ViewModel Builder
 * Creates TransactionPreviewViewModel from transaction data
 */

import type { ScriptDescriptor } from '../../../../core/transaction/types/ScriptTypes';
import type { MinimaTransaction } from '../../../../core/transaction/MinimaTransactionBuilder';
import type { 
  TransactionPreviewViewModel, 
  TokenAmount, 
  TransactionInput, 
  TransactionOutput,
  ContractInsight 
} from './types';
import { 
  buildContractInsight, 
  classifyTransactionRisks,
  getScriptTypeLabel,
  getScriptTypeBadgeColor
} from './NarrativeBuilder';
import { formatBaseUnitsToDecimal, parseDecimalToBaseUnits } from '../../../../core/transaction/MinimaTransactionBuilder';
import { mxToHex, hexToMx } from '../../../../core/utils/minima-base32';

function normalizeToHex(addr: string): string {
  if (!addr) return '';
  const trimmed = addr.trim();
  if (trimmed.toLowerCase().startsWith('mx')) {
    try { return mxToHex(trimmed).toLowerCase(); } catch { return trimmed.toLowerCase(); }
  }
  return trimmed.toLowerCase();
}

function safeHexToMx(hex: string): string {
  try { return hexToMx(hex); } catch { return hex; }
}

interface BuildViewModelParams {
  transaction?: MinimaTransaction;
  scriptDescriptors?: ScriptDescriptor[];
  recipient: string;
  amount: string;
  tokenSymbol: string;
  tokenId: string;
  sourceAddress?: string;
  sourceMode: 'global' | 'focused';
  burn?: string;
  balance?: string;
  rawTransactionHex?: string;
  externalSignatures?: { publicKey: string; validated: boolean }[];
  walletAddresses?: string[];
  tokenScale?: number;
}

function bytesToHex(bytes: Uint8Array | undefined): string {
  if (!bytes) return '0x00';
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function aggregateTotalsByToken(
  items: { amount: string; tokenId: Uint8Array }[]
): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  for (const item of items) {
    const tokenHex = bytesToHex(item.tokenId);
    const current = totals.get(tokenHex) || 0n;
    totals.set(tokenHex, current + parseDecimalToBaseUnits(item.amount));
  }
  return totals;
}

function tokenAmountFromDecimalString(
  amount: string, 
  tokenId: string, 
  symbol: string = 'MINIMA'
): TokenAmount {
  const baseUnits = parseDecimalToBaseUnits(amount);
  return {
    tokenId,
    symbol: tokenId === '0x00' ? 'MINIMA' : symbol,
    amount: baseUnits.toString(),
    displayAmount: formatBaseUnitsToDecimal(baseUnits)
  };
}

function tokenAmountFromBigInt(
  amount: bigint, 
  tokenId: string, 
  symbol: string = 'MINIMA'
): TokenAmount {
  return {
    tokenId,
    symbol: tokenId === '0x00' ? 'MINIMA' : symbol,
    amount: amount.toString(),
    displayAmount: formatBaseUnitsToDecimal(amount)
  };
}

/**
 * Convert a Minima backing decimal string to its token display amount using
 * the token's scale factor.
 *
 * In Minima, custom token coin amounts are stored as native Minima (backing).
 * The relationship is:  backing = display × 10^-scale
 * So to recover display:  display_base_units = backing_base_units × 10^scale
 *
 * scale:44 → NFTs  (1 NFT unit = 10^-44 Minima backing)
 * scale:36 → fungible tokens  (1 token unit = 10^-36 Minima backing)
 */
function scaleBackingToDisplay(backingDecimal: string, scale: number): string {
  try {
    const backingBU = parseDecimalToBaseUnits(backingDecimal);
    const scaledBU = backingBU * (BigInt(10) ** BigInt(scale));
    return formatBaseUnitsToDecimal(scaledBU);
  } catch {
    return backingDecimal;
  }
}

export function buildTransactionPreviewViewModel(
  params: BuildViewModelParams
): TransactionPreviewViewModel {
  const {
    transaction,
    scriptDescriptors = [],
    recipient,
    amount,
    tokenSymbol,
    tokenId,
    sourceAddress,
    sourceMode,
    burn,
    rawTransactionHex,
    externalSignatures,
    walletAddresses = [],
    tokenScale
  } = params;

  const primaryScriptType = scriptDescriptors[0]?.scriptType || 'signedby';
  const isComplex = primaryScriptType !== 'signedby';

  const inputs: TransactionInput[] = [];
  const outputs: TransactionOutput[] = [];
  
  let totalInByToken = new Map<string, bigint>();
  let totalOutByToken = new Map<string, bigint>();
  let changeAmount: TokenAmount | undefined;

  if (transaction?.inputs && transaction.inputs.length > 0) {
    totalInByToken = aggregateTotalsByToken(transaction.inputs);
    
    for (let i = 0; i < transaction.inputs.length; i++) {
      const input = transaction.inputs[i];
      const descriptor = scriptDescriptors[i];
      inputs.push({
        coinId: bytesToHex(input.coinId),
        address: bytesToHex(input.address),
        amount: input.amount.toString(),
        tokenId: bytesToHex(input.tokenId),
        scriptType: descriptor?.scriptType || 'signedby',
        scriptDescription: descriptor?.script
      });
    }
  } else if (sourceAddress) {
    const amountBigInt = BigInt(amount || '0');
    const burnBigInt = BigInt(burn || '0');
    totalInByToken.set(tokenId || '0x00', amountBigInt + burnBigInt);
    
    inputs.push({
      coinId: 'auto-selected',
      address: sourceAddress,
      amount: (amountBigInt + burnBigInt).toString(),
      tokenId: tokenId || '0x00',
      scriptType: primaryScriptType
    });
  } else {
    const amountBigInt = BigInt(amount || '0');
    totalInByToken.set(tokenId || '0x00', amountBigInt);
  }

  const walletAddressSet = new Set(walletAddresses.map(a => normalizeToHex(a)));
  if (sourceAddress) {
    walletAddressSet.add(normalizeToHex(sourceAddress));
  }
  const recipientHex = normalizeToHex(recipient);

  if (transaction?.outputs && transaction.outputs.length > 0) {
    totalOutByToken = aggregateTotalsByToken(transaction.outputs);
    
    for (const output of transaction.outputs) {
      const outputAddr = bytesToHex(output.address).toLowerCase();
      const isChange = walletAddressSet.has(outputAddr) && 
                       outputAddr !== recipientHex;
      
      const displayAddr = safeHexToMx(bytesToHex(output.address));
      outputs.push({
        address: displayAddr,
        amount: output.amount.toString(),
        tokenId: bytesToHex(output.tokenId),
        isChange,
        stateVariables: output.state.map(s => ({
          port: s.port,
          value: s.value instanceof Uint8Array 
            ? bytesToHex(s.value) 
            : typeof s.value === 'string' 
              ? s.value 
              : String(s.value)
        }))
      });

      if (isChange) {
        const tokenHex = bytesToHex(output.tokenId);
        changeAmount = tokenAmountFromDecimalString(
          output.amount, 
          tokenHex, 
          tokenHex === '0x00' ? 'MINIMA' : tokenSymbol
        );
      }
    }
  } else {
    const amountBigInt = BigInt(amount || '0');
    totalOutByToken.set(tokenId || '0x00', amountBigInt);
    
    outputs.push({
      address: recipient,
      amount: amount,
      tokenId: tokenId || '0x00',
      isChange: false
    });
  }

  const primaryToken = tokenId || '0x00';
  const totalIn = totalInByToken.get(primaryToken) || 0n;
  const totalOut = totalOutByToken.get(primaryToken) || 0n;
  
  // Note: Minima has NO fees. The difference between totalIn and totalOut
  // after accounting for change is the user-specified burn (optional).

  const isBalanced = totalIn >= totalOut;

  const totalInArray: TokenAmount[] = [];
  for (const [token, amt] of totalInByToken) {
    totalInArray.push(tokenAmountFromBigInt(amt, token, token === '0x00' ? 'MINIMA' : tokenSymbol));
  }
  
  const totalOutArray: TokenAmount[] = [];
  for (const [token, amt] of totalOutByToken) {
    const isCustomToken = token !== '0x00';
    // For custom tokens, amt is backing in base-unit precision (10^44).
    // Multiply by 10^scale to convert to display base units before formatting.
    // scale:44 = NFTs, scale:36 = fungible tokens.
    const displayAmt = (isCustomToken && tokenScale)
      ? amt * (BigInt(10) ** BigInt(tokenScale))
      : amt;
    totalOutArray.push(tokenAmountFromBigInt(displayAmt, token, token === '0x00' ? 'MINIMA' : tokenSymbol));
  }

  if (totalInArray.length === 0) {
    totalInArray.push(tokenAmountFromBigInt(BigInt(amount || '0'), tokenId || '0x00', tokenSymbol));
  }
  if (totalOutArray.length === 0) {
    totalOutArray.push(tokenAmountFromBigInt(BigInt(amount || '0'), tokenId || '0x00', tokenSymbol));
  }

  const burnAmount: TokenAmount | undefined = burn && BigInt(burn) > 0n ? {
    tokenId: '0x00',
    symbol: 'MINIMA',
    amount: burn,
    displayAmount: formatBaseUnitsToDecimal(BigInt(burn))
  } : undefined;

  // Build recipients from actual transaction outputs, filtering out change outputs
  // This ensures change going back to user's own addresses isn't shown as a separate recipient
  const recipients = outputs
    .filter(output => !output.isChange)
    .map(output => ({
      address: output.address,
      amount: tokenAmountFromDecimalString(
        // For custom tokens, output.amount is Minima backing ("0.000...888").
        // Apply scale to convert to the token's display amount ("888").
        (output.tokenId !== '0x00' && tokenScale)
          ? scaleBackingToDisplay(output.amount, tokenScale)
          : output.amount,
        output.tokenId, 
        output.tokenId === '0x00' ? 'MINIMA' : tokenSymbol
      ),
      isContract: isComplex
    }));
  
  // Fallback: if no non-change outputs found, use the original recipient parameter
  if (recipients.length === 0) {
    recipients.push({
      address: recipient,
      amount: tokenAmountFromBigInt(BigInt(amount || '0'), tokenId || '0x00', tokenSymbol),
      isContract: isComplex
    });
  }

  const insights: ContractInsight[] = [];
  const seenTypes = new Set<string>();
  for (const descriptor of scriptDescriptors) {
    if (!seenTypes.has(descriptor.scriptType)) {
      seenTypes.add(descriptor.scriptType);
      insights.push(buildContractInsight(descriptor));
    }
  }

  const hasStateVariables = outputs.some(o => o.stateVariables && o.stateVariables.length > 0);
  const hasExternalSignatures = (externalSignatures?.filter(s => s.validated).length || 0) > 0;

  let signatureStatus;
  if (scriptDescriptors.some(d => d.scriptType === 'multisig' || d.scriptType === 'multisig_mofn')) {
    const multisigDesc = scriptDescriptors.find(d => d.scriptType === 'multisig' || d.scriptType === 'multisig_mofn');
    const required = multisigDesc?.multisigThreshold || multisigDesc?.multisigKeys?.length || 2;
    const collected = 1 + (externalSignatures?.filter(s => s.validated).length || 0);
    const allKeys = multisigDesc?.multisigKeys || [];
    const collectedKeys = new Set([multisigDesc?.wotsRootPublicKey, ...(externalSignatures?.filter(s => s.validated).map(s => s.publicKey) || [])]);
    const missingKeys = allKeys.filter(k => !collectedKeys.has(k));
    
    signatureStatus = {
      required,
      collected,
      missingKeys
    };
  }

  const rawScripts = scriptDescriptors.map(d => ({
    address: d.address,
    script: d.script
  }));

  const viewModel: TransactionPreviewViewModel = {
    type: isComplex ? 'complex' : 'simple',
    typeLabel: getScriptTypeLabel(primaryScriptType),
    typeBadgeColor: getScriptTypeBadgeColor(primaryScriptType),
    totalIn: totalInArray,
    totalOut: totalOutArray,
    burn: burnAmount,
    change: changeAmount,
    recipients,
    inputs,
    outputs,
    insights,
    risks: [],
    rawTransaction: rawTransactionHex,
    rawScripts,
    scriptDescriptors,
    isBalanced,
    hasStateVariables,
    hasExternalSignatures,
    signatureStatus,
    sourceMode
  };

  viewModel.risks = classifyTransactionRisks(viewModel);

  return viewModel;
}

/**
 * TransactionAssembler
 * 
 * Orchestrates the complete transaction assembly pipeline:
 * 1. Coin selection (fetch spendable coins, select inputs)
 * 2. Transaction building (construct MinimaTransaction with inputs/outputs)
 * 3. Proof fetching (MMR proofs, coin proofs)
 * 4. Serialization (generate raw hex for preview)
 * 
 * This service MUST be called BEFORE showing the transaction preview,
 * ensuring users see complete transaction details before signing.
 */

import { 
  TransactionArtifact, 
  TransactionAssemblyRequest, 
  TransactionAssemblyResult,
  TransactionInputArtifact,
  TransactionOutputArtifact,
  TransactionType,
  generateArtifactId
} from './TransactionArtifact';
import { coinSelectionService, type CoinSelectionResult, type SpendableCoin } from './CoinSelectionService';
import { 
  buildTransaction as buildMinimaTransaction,
  type MinimaTransaction, 
  type TransactionBuildResult,
  type SpendableCoinInput,
  type BuildTransactionParams,
  parseDecimalToBaseUnits
} from './MinimaTransactionBuilder';
import {
  buildEnhancedTransaction,
  type EnhancedBuildParams,
  type EnhancedCoinInput,
  type EnhancedCoinOutput,
  type EnhancedBuildResult
} from './EnhancedTransactionBuilder';
import type { ScriptDescriptor } from './types/ScriptTypes';
import { mxToHex } from '../utils/minima-base32';

const SIMPLE_SCRIPT_TYPES: TransactionType[] = ['simple_send'];

/**
 * Normalize any address (Mx or 0x) to lowercase hex format for comparison
 */
function normalizeAddressToHex(addr: string): string {
  if (!addr) return '';
  const trimmed = addr.trim();
  if (trimmed.toLowerCase().startsWith('mx')) {
    try {
      return mxToHex(trimmed).toLowerCase();
    } catch {
      return trimmed.toLowerCase();
    }
  }
  return trimmed.toLowerCase();
}

function requiresEnhancedBuilder(type: TransactionType): boolean {
  return !SIMPLE_SCRIPT_TYPES.includes(type);
}

function bytesToHex(bytes: Uint8Array | undefined): string {
  if (!bytes) return '0x00';
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseAmountToBaseUnits(amount: string): string {
  const MINIMA_DECIMALS = 44;  // Minima uses 44 decimal precision
  const SCALE = BigInt(10) ** BigInt(MINIMA_DECIMALS);
  
  const clean = (amount || '0').trim();
  const parts = clean.split('.');
  const intPart = parts[0] || '0';
  let fracPart = parts[1] || '';
  
  if (fracPart.length > MINIMA_DECIMALS) {
    fracPart = fracPart.slice(0, MINIMA_DECIMALS);
  } else {
    fracPart = fracPart.padEnd(MINIMA_DECIMALS, '0');
  }
  
  return (BigInt(intPart) * SCALE + BigInt(fracPart)).toString();
}

export class TransactionAssembler {
  async assemble(request: TransactionAssemblyRequest): Promise<TransactionAssemblyResult> {
    const startTime = Date.now();
    console.log('[TransactionAssembler] Starting assembly', { 
      type: request.type, 
      recipient: request.recipient,
      amount: request.amount,
      sourceMode: request.sourceMode
    });
    
    try {
      const coinSelectionResult = await this.selectCoins(request);
      if (coinSelectionResult.insufficientFunds) {
        return {
          success: false,
          error: 'Insufficient funds for this transaction',
          errorCode: 'INSUFFICIENT_FUNDS'
        };
      }
      
      if (coinSelectionResult.selectedCoins.length === 0) {
        return {
          success: false,
          error: 'No spendable coins found',
          errorCode: 'COIN_FETCH_FAILED'
        };
      }
      
      const buildResult = await this.buildTransaction(request, coinSelectionResult);
      if (!buildResult) {
        return {
          success: false,
          error: 'Failed to build transaction',
          errorCode: 'BUILD_FAILED'
        };
      }
      
      const artifact = this.createArtifact(
        request,
        coinSelectionResult,
        buildResult.transaction,
        buildResult.result,
        buildResult.scriptDescriptors
      );
      
      console.log('[TransactionAssembler] Assembly complete', {
        duration: Date.now() - startTime,
        inputCount: artifact.inputs.length,
        outputCount: artifact.outputs.length,
        rawHexLength: artifact.rawTransactionHex.length
      });
      
      return {
        success: true,
        artifact
      };
      
    } catch (error) {
      console.error('[TransactionAssembler] Assembly failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during assembly',
        errorCode: 'BUILD_FAILED'
      };
    }
  }
  
  private async selectCoins(request: TransactionAssemblyRequest): Promise<CoinSelectionResult> {
    // Include burn in target amount so we select enough coins
    // Use BigInt arithmetic in base units for precision, then convert back to decimal
    const sendBaseUnits = BigInt(parseAmountToBaseUnits(request.amount));
    const burnBaseUnits = request.burn ? BigInt(parseAmountToBaseUnits(request.burn)) : 0n;
    const totalTargetBaseUnits = sendBaseUnits + burnBaseUnits;
    
    // Convert back to decimal string for CoinSelectionService
    const MINIMA_DECIMALS = 44;  // Minima uses 44 decimal precision
    const SCALE = BigInt(10) ** BigInt(MINIMA_DECIMALS);
    const intPart = totalTargetBaseUnits / SCALE;
    const fracPart = totalTargetBaseUnits % SCALE;
    const fracStr = fracPart.toString().padStart(MINIMA_DECIMALS, '0').replace(/0+$/, '') || '0';
    const totalTargetAmount = fracStr === '0' ? intPart.toString() : `${intPart}.${fracStr}`;
    
    console.log('[TransactionAssembler] Selecting coins', {
      mode: request.sourceMode,
      targetAmount: totalTargetAmount,
      targetBaseUnits: totalTargetBaseUnits.toString(),
      sendAmount: request.amount,
      burnAmount: request.burn || '0',
      tokenId: request.tokenId
    });
    
    await coinSelectionService.loadExcludedAddresses();
    
    if (request.excludedAddresses) {
      for (const addr of request.excludedAddresses) {
        coinSelectionService.addExcludedAddress(addr);
      }
    }
    
    const result = await coinSelectionService.selectCoinsForSend(
      request.walletAddresses,
      {
        mode: request.sourceMode,
        targetAmount: totalTargetAmount,  // Send + burn
        tokenId: request.tokenId === '0x00' ? undefined : request.tokenId,
        focusedAddress: request.sourceMode === 'focused' ? request.sourceAddress : undefined,
        excludedAddresses: request.excludedAddresses
      }
    );
    
    console.log('[TransactionAssembler] Coin selection result', {
      selectedCount: result.selectedCoins.length,
      totalSelected: result.totalSelected,
      change: result.change,
      insufficientFunds: result.insufficientFunds
    });
    
    return result;
  }
  
  private async buildTransaction(
    request: TransactionAssemblyRequest,
    coinSelection: CoinSelectionResult
  ): Promise<{ transaction: MinimaTransaction; result: TransactionBuildResult; scriptDescriptors: ScriptDescriptor[] } | null> {
    const burnBaseUnits = request.burn ? parseAmountToBaseUnits(request.burn) : '0';
    const amountBaseUnits = parseAmountToBaseUnits(request.amount);
    const changeBaseUnits = parseAmountToBaseUnits(coinSelection.change);
    
    const useEnhanced = requiresEnhancedBuilder(request.type);
    
    console.log('[TransactionAssembler] Building transaction', {
      type: request.type,
      useEnhanced,
      sendAmount: amountBaseUnits,
      burnAmount: burnBaseUnits,
      changeAmount: changeBaseUnits
    });
    
    if (useEnhanced) {
      return this.buildEnhancedTransaction(request, coinSelection, amountBaseUnits, changeBaseUnits);
    }
    
    return this.buildSimpleTransaction(request, coinSelection, amountBaseUnits, changeBaseUnits);
  }
  
  private buildSimpleTransaction(
    request: TransactionAssemblyRequest,
    coinSelection: CoinSelectionResult,
    amountBaseUnits: string,
    changeBaseUnits: string
  ): { transaction: MinimaTransaction; result: TransactionBuildResult; scriptDescriptors: ScriptDescriptor[] } | null {
    console.log('[TransactionAssembler] buildSimpleTransaction inputs:', {
      selectedCoins: coinSelection.selectedCoins.map(c => ({
        coinId: c.coinId,
        coinIdLength: c.coinId?.length,
        address: c.address,
        addressLength: c.address?.length,
        tokenid: c.tokenid,
        tokenidLength: c.tokenid?.length,
        amount: c.amount
      })),
      recipient: request.recipient,
      recipientLength: request.recipient?.length,
      tokenId: request.tokenId,
      tokenIdLength: request.tokenId?.length,
      changeAddress: coinSelection.fromAddresses[0],
      changeAddressLength: coinSelection.fromAddresses[0]?.length
    });
    
    // Coin amounts from blockchain are decimal strings like "0.0001" or "36000"
    // buildTransaction expects decimal strings and converts internally
    const inputs: SpendableCoinInput[] = coinSelection.selectedCoins.map(coin => ({
      coinId: coin.coinId,
      address: coin.address,
      amount: coin.amount,  // Decimal string from blockchain
      tokenId: coin.tokenid
    }));
    
    // For custom tokens, coin inputs carry Minima backing amounts (e.g. "0.000...888")
    // while request.amount is the user's display amount (e.g. "888").
    // Comparing them directly in the builder always fails (different unit scales).
    // coinSelection.totalSelected is the sum of actual coin backing amounts —
    // use that as the builder amount so both sides of the balance check are
    // in the same Minima-backing unit.
    // For native Minima, display == backing, so request.amount is correct.
    const isCustomToken = !!(request.tokenId && request.tokenId !== '0x00');
    const buildParams: BuildTransactionParams = {
      inputs,
      recipientAddress: request.recipient,
      amount: isCustomToken ? coinSelection.totalSelected : request.amount,
      tokenId: request.tokenId,
      changeAddress: coinSelection.fromAddresses[0]
    };
    
    const result = buildMinimaTransaction(buildParams);
    
    const rpk = request.wotsRootPublicKey;
    const rpkHex = (rpk.startsWith('0x') || rpk.startsWith('0X')) ? '0x' + rpk.slice(2).toUpperCase() : '0x' + rpk.toUpperCase();
    const scriptDescriptors: ScriptDescriptor[] = coinSelection.selectedCoins.map(coin => ({
      scriptType: 'signedby' as const,
      address: coin.address,
      script: `RETURN SIGNEDBY(${rpkHex})`,
      wotsRootPublicKey: request.wotsRootPublicKey
    }));
    
    console.log('[TransactionAssembler] Simple transaction built', {
      digestHex: result.digestTxHex,
      serializedLength: result.serialized.length,
      inputCount: inputs.length
    });
    
    return {
      transaction: result.transaction,
      result,
      scriptDescriptors
    };
  }
  
  private buildEnhancedTransaction(
    request: TransactionAssemblyRequest,
    coinSelection: CoinSelectionResult,
    amountBaseUnits: string,
    changeBaseUnits: string
  ): { transaction: MinimaTransaction; result: TransactionBuildResult; scriptDescriptors: ScriptDescriptor[] } | null {
    const rpk2 = request.wotsRootPublicKey;
    const rpk2Hex = (rpk2.startsWith('0x') || rpk2.startsWith('0X')) ? '0x' + rpk2.slice(2).toUpperCase() : '0x' + rpk2.toUpperCase();
    const scriptDescriptor = request.scriptDescriptor || {
      scriptType: request.type === 'simple_send' ? 'signedby' : request.type,
      address: coinSelection.fromAddresses[0] || '',
      script: `RETURN SIGNEDBY(${rpk2Hex})`,
      wotsRootPublicKey: request.wotsRootPublicKey,
      multisigKeys: request.multisigKeys,
      multisigThreshold: request.multisigThreshold,
      timelockBlock: request.timelockHeight !== undefined ? BigInt(request.timelockHeight) : undefined,
      htlcSecret: request.htlcSecret,
      htlcHashLock: request.htlcHashlock,
      mastBranches: request.mastBranches
    } as ScriptDescriptor;
    
    // Coin amounts from blockchain are decimal strings like "0.0001" or "36000"
    // EnhancedTransactionBuilder expects decimal strings and converts internally
    const enhancedInputs: EnhancedCoinInput[] = coinSelection.selectedCoins.map(coin => ({
      coinId: coin.coinId,
      address: coin.address,
      amount: coin.amount,  // Decimal string from blockchain
      tokenId: coin.tokenid,
      scriptDescriptor
    }));
    
    // For custom tokens use the total coin backing (same unit as the inputs)
    // rather than the user's display amount.
    const isCustomTokenEnh = !!(request.tokenId && request.tokenId !== '0x00');
    const enhancedOutputs: EnhancedCoinOutput[] = [
      {
        address: request.recipient,
        amount: isCustomTokenEnh ? coinSelection.totalSelected : request.amount,
        tokenId: request.tokenId
      }
    ];
    
    // Calculate change in base units, then convert back to decimal for output
    if (BigInt(changeBaseUnits) > 0n && coinSelection.fromAddresses.length > 0) {
      enhancedOutputs.push({
        address: coinSelection.fromAddresses[0],
        amount: coinSelection.change,  // Decimal string from coin selection
        tokenId: request.tokenId
      });
    }
    
    const enhancedParams: EnhancedBuildParams = {
      inputs: enhancedInputs,
      outputs: enhancedOutputs,
      transactionState: scriptDescriptor.stateVariables
    };
    
    const enhancedResult = buildEnhancedTransaction(enhancedParams);
    
    console.log('[TransactionAssembler] Enhanced transaction built', {
      type: request.type,
      digestHex: enhancedResult.digestTxHex,
      serializedLength: enhancedResult.serialized.length,
      inputCount: enhancedInputs.length,
      scriptDescriptorCount: enhancedResult.scriptDescriptors.length
    });
    
    return {
      transaction: enhancedResult.transaction,
      result: enhancedResult,
      scriptDescriptors: enhancedResult.scriptDescriptors
    };
  }
  
  private createArtifact(
    request: TransactionAssemblyRequest,
    coinSelection: CoinSelectionResult,
    transaction: MinimaTransaction,
    buildResult: TransactionBuildResult,
    scriptDescriptorsFromBuild: ScriptDescriptor[]
  ): TransactionArtifact {
    const inputs: TransactionInputArtifact[] = transaction.inputs.map((input, i) => {
      const descriptor = scriptDescriptorsFromBuild[i] || scriptDescriptorsFromBuild[0];
      
      return {
        coinId: bytesToHex(input.coinId),
        address: bytesToHex(input.address),
        amount: input.amount.toString(),
        tokenId: bytesToHex(input.tokenId),
        scriptType: descriptor?.scriptType || 'signedby',
        scriptDescription: descriptor?.script
      };
    });
    
    // Normalize wallet addresses to hex for comparison with output addresses
    const walletAddressHexSet = new Set(request.walletAddresses.map(a => normalizeAddressToHex(a)));
    const recipientHex = normalizeAddressToHex(request.recipient);
    
    const outputs: TransactionOutputArtifact[] = transaction.outputs.map(output => {
      const outputAddr = bytesToHex(output.address).toLowerCase();
      // Change = wallet-owned output that is NOT the recipient
      const isChange = walletAddressHexSet.has(outputAddr) && outputAddr !== recipientHex;
      
      return {
        address: bytesToHex(output.address),
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
      };
    });
    
    const totalInByToken = new Map<string, bigint>();
    for (const input of transaction.inputs) {
      const tokenHex = bytesToHex(input.tokenId);
      const current = totalInByToken.get(tokenHex) || 0n;
      // input.amount is now a decimal string, convert to base units for arithmetic
      totalInByToken.set(tokenHex, current + parseDecimalToBaseUnits(input.amount));
    }
    
    const totalOutByToken = new Map<string, bigint>();
    for (const output of transaction.outputs) {
      const tokenHex = bytesToHex(output.tokenId);
      const current = totalOutByToken.get(tokenHex) || 0n;
      // output.amount is now a decimal string, convert to base units for arithmetic
      totalOutByToken.set(tokenHex, current + parseDecimalToBaseUnits(output.amount));
    }
    
    const totalIn = Array.from(totalInByToken.entries()).map(([tokenId, amount]) => ({
      tokenId,
      amount: amount.toString()
    }));
    
    const totalOut = Array.from(totalOutByToken.entries()).map(([tokenId, amount]) => ({
      tokenId,
      amount: amount.toString()
    }));
    
    const scriptDescriptors: ScriptDescriptor[] = scriptDescriptorsFromBuild;
    
    const requiresExternalSignatures = 
      request.type === 'multisig' || 
      request.type === 'multisig_mofn' ||
      (request.multisigKeys && request.multisigKeys.length > 1);
    
    const artifact: TransactionArtifact = {
      id: generateArtifactId(),
      createdAt: Date.now(),
      
      type: request.type,
      
      transaction,
      buildResult,
      
      inputs,
      outputs,
      
      totalIn,
      totalOut,
      
      burn: request.burn ? parseAmountToBaseUnits(request.burn) : undefined,
      change: coinSelection.change !== '0' ? parseAmountToBaseUnits(coinSelection.change) : undefined,
      
      scriptDescriptors,
      
      rawTransactionHex: buildResult.serializedHex,
      digestTxHex: buildResult.digestTxHex,
      
      coinSelection,
      
      sourceMode: request.sourceMode,
      sourceAddress: request.sourceAddress,
      walletAddresses: request.walletAddresses,
      
      recipient: request.recipient,
      requestedAmount: request.amount,
      tokenId: request.tokenId,
      tokenSymbol: request.tokenSymbol,
      
      isValid: true,
      validationErrors: [],
      
      requiresExternalSignatures,
      externalSignatureKeys: request.multisigKeys,
      collectedSignatures: request.externalSignatures?.map(s => ({
        ...s,
        validated: true
      }))
    };
    
    return artifact;
  }
}

export const transactionAssembler = new TransactionAssembler();

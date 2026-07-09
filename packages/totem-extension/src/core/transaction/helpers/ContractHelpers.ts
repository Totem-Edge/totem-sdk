/**
 * Contract Helpers
 * 
 * Provides high-level helpers for building specific contract types:
 * - Timelock contracts
 * - HTLC (Hashed Timelock Contracts)
 * - MAST (Merkelized Abstract Syntax Trees)
 * - Exchange contracts
 * - Vault/covenant contracts
 * - Flash/slow cash
 * - Stateful game contracts
 * 
 * Each helper validates inputs and builds the appropriate ScriptDescriptor
 * for use with the EnhancedTransactionBuilder.
 */

import { sha3_256 } from 'js-sha3';
import { sha256 } from '@noble/hashes/sha256';
import type {
  ScriptDescriptor,
  StateValue,
  MMRProof,
  VerifyOutExpectation
} from '../types/ScriptTypes';
import {
  createTimelockDescriptor,
  createHTLCDescriptor,
  createMASTDescriptor,
  createExchangeDescriptor,
  createFlashCashDescriptor,
  createSlowCashDescriptor,
  createEmptyMMRProof
} from '../types/ScriptTypes';

function kissHex(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return '0x' + raw.toUpperCase();
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Timelock Helper
 * 
 * Creates timelocked scripts that can only be spent after a certain block.
 */
export class TimelockHelper {
  /**
   * Create a timelock script that unlocks at a specific block.
   */
  static createBlockTimelock(
    publicKey: string,
    unlockBlock: bigint
  ): { script: string; address: string } {
    const script = `RETURN SIGNEDBY(${kissHex(publicKey)}) AND @BLOCK GT ${unlockBlock}`;
    const address = computeScriptAddress(script);
    
    return { script, address };
  }
  
  /**
   * Create a timelock script based on coin age.
   */
  static createCoinageTimelock(
    publicKey: string,
    minCoinAge: bigint
  ): { script: string; address: string } {
    const script = `RETURN SIGNEDBY(${kissHex(publicKey)}) AND @COINAGE GT ${minCoinAge}`;
    const address = computeScriptAddress(script);
    
    return { script, address };
  }
  
  /**
   * Check if a timelock is satisfied given current block.
   */
  static isUnlocked(unlockBlock: bigint, currentBlock: bigint): boolean {
    return currentBlock > unlockBlock;
  }
  
  /**
   * Build ScriptDescriptor for a timelock spend.
   */
  static buildDescriptor(
    address: string,
    publicKey: string,
    unlockBlock: bigint
  ): ScriptDescriptor {
    return createTimelockDescriptor(address, publicKey, unlockBlock);
  }
}

/**
 * HTLC Helper
 * 
 * Creates Hashed Timelock Contracts for atomic swaps and lightning-style payments.
 */
export class HTLCHelper {
  /**
   * Generate a random preimage and its hash.
   */
  static generateSecret(): { preimage: string; hash: string } {
    const preimageBytes = new Uint8Array(32);
    crypto.getRandomValues(preimageBytes);
    const preimage = bytesToHex(preimageBytes);
    
    const hashBytes = new Uint8Array(sha3_256.arrayBuffer(preimageBytes));
    const hash = bytesToHex(hashBytes);
    
    return { preimage, hash };
  }
  
  /**
   * Hash a preimage using SHA3 (default) or SHA2.
   */
  static hashPreimage(preimage: string, algorithm: 'sha3' | 'sha2' = 'sha3'): string {
    const preimageBytes = hexToBytes(preimage);
    
    if (algorithm === 'sha2') {
      const hashBytes = sha256(preimageBytes);
      return bytesToHex(hashBytes);
    } else {
      const hashBytes = new Uint8Array(sha3_256.arrayBuffer(preimageBytes));
      return bytesToHex(hashBytes);
    }
  }
  
  /**
   * Verify a preimage matches a hash.
   */
  static verifyPreimage(
    preimage: string,
    expectedHash: string,
    algorithm: 'sha3' | 'sha2' = 'sha3'
  ): boolean {
    const computedHash = this.hashPreimage(preimage, algorithm);
    return computedHash.toLowerCase() === expectedHash.toLowerCase();
  }
  
  /**
   * Create an HTLC script.
   * 
   * The script allows:
   * - Recipient to claim with preimage before timeout
   * - Sender to refund after timeout
   */
  static createHTLC(
    senderPublicKey: string,
    recipientPublicKey: string,
    hashLock: string,
    timeoutBlock: bigint,
    algorithm: 'sha3' | 'sha2' = 'sha3'
  ): { script: string; address: string } {
    const hashFunc = algorithm === 'sha2' ? 'SHA2' : 'SHA3';
    
    const script = `IF @BLOCK GT ${timeoutBlock} AND SIGNEDBY(${kissHex(senderPublicKey)}) THEN RETURN TRUE ENDIF RETURN (SIGNEDBY(${kissHex(recipientPublicKey)}) AND ${hashFunc}(STATE(1)) EQ ${kissHex(hashLock)})`;
    
    const address = computeScriptAddress(script);
    
    return { script, address };
  }
  
  /**
   * Build ScriptDescriptor to claim HTLC with preimage.
   */
  static buildClaimDescriptor(
    address: string,
    senderPublicKey: string,
    recipientPublicKey: string,
    hashLock: string,
    timeoutBlock: bigint,
    preimage: string
  ): ScriptDescriptor {
    return createHTLCDescriptor(
      address,
      senderPublicKey,
      recipientPublicKey,
      hashLock,
      timeoutBlock,
      false,
      preimage
    );
  }
  
  /**
   * Build ScriptDescriptor to refund HTLC after timeout.
   */
  static buildRefundDescriptor(
    address: string,
    senderPublicKey: string,
    recipientPublicKey: string,
    hashLock: string,
    timeoutBlock: bigint
  ): ScriptDescriptor {
    return createHTLCDescriptor(
      address,
      senderPublicKey,
      recipientPublicKey,
      hashLock,
      timeoutBlock,
      true
    );
  }
}

/**
 * MAST Helper
 * 
 * Creates Merkelized Abstract Syntax Tree contracts for privacy and scalability.
 */
export class MASTHelper {
  /**
   * Compute hash of a script for MAST leaf.
   */
  static hashScript(script: string): string {
    const scriptBytes = new TextEncoder().encode(script.trim().toUpperCase());
    const hashBytes = new Uint8Array(sha3_256.arrayBuffer(scriptBytes));
    return bytesToHex(hashBytes);
  }
  
  /**
   * Build a simple MAST tree from multiple scripts.
   * Returns the root hash and proofs for each script.
   * 
   * For a proper implementation, this should call the mmrcreate RPC.
   * This is a simplified local version for 2 scripts.
   */
  static buildSimpleTree(scripts: string[]): {
    root: string;
    proofs: Map<string, { proof: string; index: number }>;
  } {
    if (scripts.length === 0) {
      throw new Error('MAST requires at least one script');
    }
    
    if (scripts.length === 1) {
      const hash = this.hashScript(scripts[0]);
      return {
        root: hash,
        proofs: new Map([[scripts[0], { proof: '', index: 0 }]])
      };
    }
    
    const hashes = scripts.map(s => this.hashScript(s));
    const proofs = new Map<string, { proof: string; index: number }>();
    
    for (let i = 0; i < scripts.length; i++) {
      const siblingIndex = i % 2 === 0 ? i + 1 : i - 1;
      const siblingHash = hashes[siblingIndex] || hashes[i];
      const isLeft = i % 2 === 1;
      
      const proofHex = encodeSimpleProof(siblingHash, isLeft);
      proofs.set(scripts[i], { proof: proofHex, index: i });
    }
    
    const combinedBytes = hexToBytes(hashes[0].slice(2) + hashes[1].slice(2));
    const rootBytes = new Uint8Array(sha3_256.arrayBuffer(combinedBytes));
    const root = bytesToHex(rootBytes);
    
    return { root, proofs };
  }
  
  /**
   * Create a MAST script with the given root hash.
   */
  static createMASTScript(rootHash: string): { script: string; address: string } {
    const script = `MAST ${kissHex(rootHash)}`;
    const address = computeScriptAddress(script);
    
    return { script, address };
  }
  
  /**
   * Build ScriptDescriptor for spending a MAST branch.
   */
  static buildDescriptor(
    address: string,
    rootHash: string,
    branchScript: string,
    branchProof: string,
    wotsPublicKey?: string
  ): ScriptDescriptor {
    return createMASTDescriptor(
      address,
      rootHash,
      branchScript,
      branchProof,
      wotsPublicKey
    );
  }
}

/**
 * Exchange Contract Helper
 * 
 * Creates DEX-style exchange contracts using VERIFYOUT.
 */
export class ExchangeHelper {
  /**
   * Create an exchange offer script.
   * 
   * Owner can cancel, or anyone can take the offer by providing
   * the specified output.
   */
  static createOffer(
    ownerPublicKey: string,
    desiredAddress: string,
    desiredAmount: string,
    desiredTokenId: string
  ): { script: string; address: string } {
    const script = `IF SIGNEDBY(PREVSTATE(0)) THEN RETURN TRUE ENDIF ASSERT VERIFYOUT(@INPUT PREVSTATE(1) PREVSTATE(2) PREVSTATE(3) TRUE) RETURN TRUE`;
    const address = computeScriptAddress(script);
    
    return { script, address };
  }
  
  /**
   * Build state variables for an exchange offer.
   */
  static buildOfferState(
    ownerPublicKey: string,
    desiredAddress: string,
    desiredAmount: string,
    desiredTokenId: string
  ): StateValue[] {
    return [
      { port: 0, value: ownerPublicKey, type: 'hex' },
      { port: 1, value: desiredAddress, type: 'hex' },
      { port: 2, value: desiredAmount, type: 'number' },
      { port: 3, value: desiredTokenId, type: 'hex' }
    ];
  }
  
  /**
   * Build ScriptDescriptor for taking an exchange offer.
   */
  static buildTakeOfferDescriptor(
    address: string,
    ownerPublicKey: string,
    desiredAddress: string,
    desiredAmount: string,
    desiredTokenId: string
  ): ScriptDescriptor {
    return createExchangeDescriptor(
      address,
      ownerPublicKey,
      desiredAddress,
      desiredAmount,
      desiredTokenId
    );
  }
  
  /**
   * Validate VERIFYOUT for an exchange transaction.
   */
  static validateExchange(
    outputs: Array<{ address: string; amount: string; tokenId: string }>,
    expectedAddress: string,
    expectedAmount: string,
    expectedTokenId: string,
    inputIndex: number
  ): { valid: boolean; error?: string } {
    if (inputIndex >= outputs.length) {
      return { valid: false, error: `Output at index ${inputIndex} does not exist` };
    }
    
    const output = outputs[inputIndex];
    
    if (output.address.toLowerCase() !== expectedAddress.toLowerCase()) {
      return { valid: false, error: 'Address mismatch' };
    }
    
    if (output.amount !== expectedAmount) {
      return { valid: false, error: 'Amount mismatch' };
    }
    
    if (output.tokenId.toLowerCase() !== expectedTokenId.toLowerCase()) {
      return { valid: false, error: 'TokenId mismatch' };
    }
    
    return { valid: true };
  }
}

/**
 * Vault Helper
 * 
 * Creates vault/covenant contracts with safe house enforcement.
 */
export class VaultHelper {
  /**
   * Generate safe house script from vault parameters.
   */
  static generateSafeHouseScript(
    coldKey: string,
    hotKey: string,
    cooldownBlocks: bigint = 20n
  ): string {
    return `LET pkcold = ${kissHex(coldKey)} LET pkhot = ${kissHex(hotKey)} IF SIGNEDBY(pkcold) THEN RETURN TRUE ENDIF IF SIGNEDBY(pkhot) THEN IF @COINAGE GT ${cooldownBlocks} THEN RETURN VERIFYOUT(@INPUT PREVSTATE(21) @AMOUNT @TOKENID TRUE) ENDIF ENDIF`;
  }
  
  /**
   * Create a vault script.
   */
  static createVault(
    coldKey: string,
    hotKey: string,
    cooldownBlocks: bigint = 20n
  ): { vaultScript: string; vaultAddress: string; safeHouseScript: string; safeHouseAddress: string } {
    const safeHouseScript = this.generateSafeHouseScript(coldKey, hotKey, cooldownBlocks);
    const safeHouseAddress = computeScriptAddress(safeHouseScript);
    
    const vaultScript = `LET pkcold = ${kissHex(coldKey)} LET pkhot = ${kissHex(hotKey)} IF SIGNEDBY(pkcold) THEN RETURN TRUE ENDIF LET amt = STATE(20) LET recip = STATE(21) LET safehouse = [${safeHouseScript}] ASSERT VERIFYOUT(@INPUT ADDRESS(safehouse) amt @TOKENID TRUE) LET chg = @AMOUNT - amt IF chg GT 0 THEN ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS (@AMOUNT - amt) @TOKENID TRUE) ENDIF RETURN SIGNEDBY(pkhot)`;
    
    const vaultAddress = computeScriptAddress(vaultScript);
    
    return {
      vaultScript,
      vaultAddress,
      safeHouseScript,
      safeHouseAddress
    };
  }
  
  /**
   * Build state for vault withdrawal.
   */
  static buildWithdrawalState(
    amount: string,
    recipientAddress: string
  ): StateValue[] {
    return [
      { port: 20, value: amount, type: 'number' },
      { port: 21, value: recipientAddress, type: 'hex' }
    ];
  }
}

/**
 * Flash Cash Helper
 * 
 * Creates flash loan contracts for single-transaction borrowing.
 */
export class FlashCashHelper {
  /**
   * Create a flash cash contract.
   */
  static createFlashCash(
    ownerPublicKey: string,
    interestMultiplier: string = '1.01'
  ): { script: string; address: string } {
    const script = `IF SIGNEDBY(PREVSTATE(1)) THEN RETURN TRUE ENDIF ASSERT SAMESTATE(1 1) RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT*${interestMultiplier} @TOKENID TRUE)`;
    const address = computeScriptAddress(script);
    
    return { script, address };
  }
  
  /**
   * Calculate return amount with interest.
   */
  static calculateReturn(
    borrowAmount: bigint,
    interestMultiplier: number
  ): bigint {
    const multiplied = Number(borrowAmount) * interestMultiplier;
    return BigInt(Math.ceil(multiplied));
  }
  
  /**
   * Build ScriptDescriptor for borrowing flash cash.
   */
  static buildBorrowDescriptor(
    address: string,
    ownerPublicKey: string,
    interestMultiplier: string = '1.01'
  ): ScriptDescriptor {
    return createFlashCashDescriptor(address, ownerPublicKey, interestMultiplier);
  }
}

/**
 * Slow Cash Helper
 * 
 * Creates rate-limited withdrawal contracts.
 */
export class SlowCashHelper {
  /**
   * Create a slow cash contract.
   */
  static createSlowCash(
    ownerPublicKey: string,
    withdrawalPercent: string = '0.9',
    cooldownBlocks: bigint = 10000n
  ): { script: string; address: string } {
    const script = `IF @COINAGE LT ${cooldownBlocks} THEN RETURN FALSE ENDIF ASSERT SIGNEDBY(${kissHex(ownerPublicKey)}) AND VERIFYOUT(@INPUT @ADDRESS @AMOUNT*${withdrawalPercent} @TOKENID TRUE)`;
    const address = computeScriptAddress(script);
    
    return { script, address };
  }
  
  /**
   * Calculate withdrawal amount.
   */
  static calculateWithdrawal(
    currentAmount: bigint,
    withdrawalPercent: number
  ): { withdrawal: bigint; remaining: bigint } {
    const remaining = BigInt(Math.floor(Number(currentAmount) * withdrawalPercent));
    const withdrawal = currentAmount - remaining;
    
    return { withdrawal, remaining };
  }
  
  /**
   * Check if withdrawal is allowed based on coin age.
   */
  static canWithdraw(coinAge: bigint, cooldownBlocks: bigint): boolean {
    return coinAge >= cooldownBlocks;
  }
  
  /**
   * Build ScriptDescriptor for slow cash withdrawal.
   */
  static buildWithdrawalDescriptor(
    address: string,
    ownerPublicKey: string,
    withdrawalPercent: string = '0.9',
    cooldownBlocks: bigint = 10000n
  ): ScriptDescriptor {
    return createSlowCashDescriptor(address, ownerPublicKey, withdrawalPercent, cooldownBlocks);
  }
}

/**
 * Stateful Game Helper
 * 
 * Creates multi-round stateful contracts (like coin flip).
 */
export class StatefulGameHelper {
  /**
   * Create a round increment assertion.
   */
  static createRoundCheck(): string {
    return `LET round = STATE(0) LET prevround = PREVSTATE(0) ASSERT round EQ INC(prevround)`;
  }
  
  /**
   * Build state for next round.
   */
  static buildNextRoundState(
    currentRound: number,
    preservedPorts: number[],
    newStates: StateValue[]
  ): StateValue[] {
    const states: StateValue[] = [
      { port: 0, value: BigInt(currentRound + 1), type: 'number' }
    ];
    
    for (const sv of newStates) {
      states.push(sv);
    }
    
    return states;
  }
  
  /**
   * Validate round progression.
   */
  static validateRound(
    previousRound: number,
    currentRound: number
  ): boolean {
    return currentRound === previousRound + 1;
  }
}

function computeScriptAddress(script: string): string {
  const cleanScript = script.trim().toUpperCase();
  const scriptBytes = new TextEncoder().encode(cleanScript);
  const hashBytes = new Uint8Array(sha3_256.arrayBuffer(scriptBytes));
  return bytesToHex(hashBytes);
}

function encodeSimpleProof(siblingHash: string, isLeft: boolean): string {
  const parts: number[] = [];
  
  parts.push(0, 0, 0, 1, 0, 1);
  
  parts.push(isLeft ? 1 : 0);
  
  const hashBytes = hexToBytes(siblingHash);
  parts.push(0, 0, 0, hashBytes.length);
  parts.push(...Array.from(hashBytes));
  
  parts.push(0, 0, 0, 0, 1, 0);
  
  return bytesToHex(new Uint8Array(parts));
}

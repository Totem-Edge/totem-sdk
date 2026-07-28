/**
 * Send Transaction Hook
 * 
 * Orchestrates the complete WOTS transaction workflow:
 * 1. Check wallet lock state (triggers unlock if needed)
 * 2. Validate inputs (drafting → reviewing)
 * 3. Request WOTS lease + sign locally (signing)
 * 4. Submit to network (submitting)
 * 5. Poll for confirmation (pending)
 * 6. Refresh balance and history (confirmed)
 * 7. Handle errors (failed)
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type TransactionStatus = 
  | 'idle'        // Initial state, ready to start
  | 'drafting'    // User is entering transaction details
  | 'reviewing'   // Pre-send confirmation screen (shows summary)
  | 'signing'     // Acquiring WOTS lease + signing locally
  | 'submitting'  // Sending signed transaction to network
  | 'pending'     // Waiting for blockchain confirmation
  | 'confirmed'   // Transaction confirmed on chain
  | 'unconfirmed' // Transaction broadcast but confirmation timed out - may still confirm
  | 'failed';     // Transaction failed at any stage

export type TransactionStage = 
  | 'validation'
  | 'unlock'
  | 'prepare'
  | 'mining'
  | 'sign'
  | 'finalize'
  | 'polling'
  | 'complete'
  | 'unknown';

export interface SendTransactionParams {
  address: string;
  amount: string;
  tokenid?: string;
  sourceAddress?: string;
  sendMode?: 'global' | 'focused';
  excludedAddresses?: string[];
  burn?: string; // Optional burn amount in base units for transaction priority
}

export interface TransactionResult {
  txpowid: string;
  leaseId: string;
  addressIndex: number;
  l1: number;
  l2: number;
  blockHeight?: number;
  /** How this transaction's TxPoW was mined. 'meg' = MEG node mined; 'local' = browser-mined. */
  miningSource: 'local' | 'meg';
}

export interface UseSendTransactionResult {
  status: TransactionStatus;
  stage: TransactionStage | null;
  error: string | null;
  txpowid: string | null;
  result: TransactionResult | null;
  // Actions
  startDraft: () => void;
  review: (params: SendTransactionParams) => void;
  confirmAndSend: () => Promise<void>;
  sendTransaction: (params: SendTransactionParams) => Promise<void>;
  reset: () => void;
  // Current params (for review screen)
  pendingParams: SendTransactionParams | null;
}

const POLL_INTERVAL = 1000; // 1 second
const CONFIRMATION_TIMEOUT = 60000; // 60 seconds

export interface UseSendTransactionOptions {
  onUnlockRequired?: (reason: string, retryAction: () => Promise<void>) => void;
}

export function useSendTransaction(options?: UseSendTransactionOptions): UseSendTransactionResult {
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [stage, setStage] = useState<TransactionStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txpowid, setTxpowid] = useState<string | null>(null);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [pendingParams, setPendingParams] = useState<SendTransactionParams | null>(null);
  
  const pendingParamsRef = useRef<SendTransactionParams | null>(null);
  pendingParamsRef.current = pendingParams;

  // Mirror status into a ref so the message listener can read the current value
  const statusRef = useRef<TransactionStatus>('idle');
  statusRef.current = status;

  // Listen for TX_STAGE_UPDATE messages from the background service worker.
  // The background fires this during local WASM mining so the UI can show
  // "Mining transaction…" while the service worker is occupied.
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg?.type === 'TX_STAGE_UPDATE' && statusRef.current === 'signing') {
        if (msg.stage === 'mining') {
          setStage('mining');
        }
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setStage(null);
    setError(null);
    setTxpowid(null);
    setResult(null);
    setPendingParams(null);
  }, []);

  const startDraft = useCallback(() => {
    setStatus('drafting');
    setError(null);
  }, []);

  const review = useCallback((params: SendTransactionParams) => {
    setPendingParams(params);
    setStatus('reviewing');
    setError(null);
  }, []);

  const confirmAndSend = useCallback(async () => {
    if (!pendingParams) {
      setError('No transaction parameters set');
      setStatus('failed');
      return;
    }
    await executeTransaction(pendingParams);
  }, [pendingParams]);

  const checkWalletLocked = async (): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'wallet:getState'
      });
      return response?.result?.locked === true || response?.result?.sessionExpired === true;
    } catch (e) {
      console.warn('[useSendTransaction] Failed to check lock state:', e);
      return false;
    }
  };

  const executeTransaction = async (params: SendTransactionParams) => {
    try {
      // Reset error state
      setError(null);
      setStage(null);
      
      // Validation
      if (!params.address || !params.amount) {
        setStage('validation');
        throw new Error('Address and amount are required');
      }

      // Preflight: Check if wallet is locked
      setStage('unlock');
      const isLocked = await checkWalletLocked();
      if (isLocked) {
        console.log('[useSendTransaction] Wallet is locked, requesting unlock...');
        if (options?.onUnlockRequired) {
          options.onUnlockRequired(
            'Your wallet is locked. Enter your password to send this transaction.',
            async () => {
              if (pendingParamsRef.current) {
                await executeTransaction(pendingParamsRef.current);
              }
            }
          );
          return;
        } else {
          throw new Error('Wallet is locked. Please unlock to send transactions.');
        }
      }

      // Signing phase (includes prepare + sign)
      setStatus('signing');
      setStage('prepare');
      console.log('[useSendTransaction] Starting WOTS transaction:', params);

      // Call the orchestrated WOTS_SEND handler
      const wotsResponse = await chrome.runtime.sendMessage({
        method: 'WOTS_SEND',
        params: {
          to: params.address,
          amount: params.amount,
          tokenid: params.tokenid || '0x00',
          sourceAddress: params.sourceAddress,
          sendMode: params.sendMode || 'global',
          excludedAddresses: params.excludedAddresses,
          burn: params.burn || '0' // Optional burn for priority (defaults to 0)
        }
      });

      console.log('[useSendTransaction] WOTS_SEND response:', wotsResponse);

      if (!wotsResponse?.ok) {
        setStage(wotsResponse?.stage || 'unknown');
        const errorMsg = wotsResponse?.error || 'Transaction failed';
        
        // Provide user-friendly error messages with unlock flow integration
        if (errorMsg.includes('SESSION_EXPIRED') || errorMsg.includes('locked') || wotsResponse?.stage === 'unlock') {
          console.log('[useSendTransaction] Wallet locked/session expired, triggering unlock...');
          if (options?.onUnlockRequired) {
            options.onUnlockRequired(
              errorMsg.includes('SESSION_EXPIRED') 
                ? 'Your session has expired. Enter your password to continue.'
                : 'Your wallet is locked. Enter your password to send this transaction.',
              async () => {
                if (pendingParamsRef.current) {
                  await executeTransaction(pendingParamsRef.current);
                }
              }
            );
            return;
          }
          throw new Error(errorMsg.includes('SESSION_EXPIRED') 
            ? 'Session expired. Please unlock your wallet again to continue.'
            : 'Wallet is locked. Please unlock to send transactions.');
        } else if (errorMsg.includes('lease') || wotsResponse?.stage === 'prepare') {
          throw new Error('Failed to prepare transaction. Please try again.');
        } else if (errorMsg.includes('sign') || wotsResponse?.stage === 'sign') {
          throw new Error('Failed to sign transaction. Please try again.');
        } else if (errorMsg.includes('finalize') || wotsResponse?.stage === 'finalize') {
          throw new Error('Failed to submit transaction. Please try again.');
        } else {
          throw new Error(errorMsg);
        }
      }

      const txid = wotsResponse.txpowid;
      if (!txid) {
        throw new Error('No transaction ID returned');
      }

      // Store result
      setResult({
        txpowid: txid,
        leaseId: wotsResponse.leaseId,
        addressIndex: wotsResponse.addressIndex,
        l1: wotsResponse.l1,
        l2: wotsResponse.l2,
        miningSource: (wotsResponse.miningSource as 'local' | 'meg') ?? 'meg',
      });
      setTxpowid(txid);
      
      // Submitting phase complete, now pending confirmation
      setStatus('pending');
      setStage('polling');
      console.log('[useSendTransaction] Transaction submitted, polling for confirmation:', txid);

      // Poll for confirmation
      const confirmed = await pollForConfirmation(txid);

      if (!confirmed) {
        console.warn('[useSendTransaction] Confirmation timeout, tx may still confirm later:', txid);
        setStage('complete');
        setStatus('unconfirmed');
      } else {
        setResult(prev => prev ? { ...prev, blockHeight: confirmed.blockHeight } : prev);
        setStage('complete');
        setStatus('confirmed');
        console.log('[useSendTransaction] Transaction confirmed at block:', confirmed.blockHeight);
      }

      // Refresh wallet state
      await refreshWalletState();
      console.log('[useSendTransaction] Wallet state refreshed');

    } catch (err: any) {
      console.error('[useSendTransaction] Transaction failed:', err);
      setError(err.message || 'Transaction failed');
      setStatus('failed');
    }
  };

  const sendTransaction = useCallback(async (params: SendTransactionParams) => {
    setPendingParams(params);
    await executeTransaction(params);
  }, []);

  return {
    status,
    stage,
    error,
    txpowid,
    result,
    startDraft,
    review,
    confirmAndSend,
    sendTransaction,
    reset,
    pendingParams
  };
}

/**
 * Poll txpow endpoint until transaction is confirmed or timeout
 */
async function pollForConfirmation(txpowid: string): Promise<{ blockHeight?: number } | false> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < CONFIRMATION_TIMEOUT) {
    try {
      const txpowResponse = await chrome.runtime.sendMessage({
        method: 'RPC_COMMAND',
        params: {
          command: 'txpow',
          params: { txpowid }
        }
      });

      console.log('[useSendTransaction] Poll response:', JSON.stringify(txpowResponse)?.slice(0, 200));

      const rpcResult = txpowResponse?.result?.response;
      if (rpcResult?.status === true && rpcResult?.response) {
        const txpowData = rpcResult.response;
        const blockHeight = txpowData?.header?.block
          ? parseInt(txpowData.header.block, 10)
          : undefined;
        console.log('[useSendTransaction] TxPoW found by node, block:', blockHeight);
        return { blockHeight };
      }

      if (txpowResponse?.ok === false) {
        console.warn('[useSendTransaction] RPC error during poll:', txpowResponse?.error);
      }

      await sleep(POLL_INTERVAL);
    } catch (error) {
      console.warn('[useSendTransaction] Polling error:', error);
    }
  }

  return false;
}

/**
 * Refresh wallet balance and history after transaction
 */
async function refreshWalletState(): Promise<void> {
  try {
    // Trigger history refresh in background
    await chrome.runtime.sendMessage({
      method: 'wallet:refreshHistory'
    });
    
    // Trigger balance refresh - this will cause UI to reload
    await chrome.runtime.sendMessage({
      method: 'wallet:getState'
    });
    
    console.log('[useSendTransaction] Wallet state refresh triggered');
  } catch (error) {
    console.warn('[useSendTransaction] Failed to refresh wallet state:', error);
    // Non-critical error, don't throw
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

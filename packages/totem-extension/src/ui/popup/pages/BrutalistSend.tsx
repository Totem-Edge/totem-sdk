/**
 * AXIA TOTEM SEND PAGE - BRUTALIST REDESIGN
 * Send assets with 44-decimal precision, MetaMask-style Review & Confirm + Transaction Receipt screens
 * 1-address model: always sends from the active account
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  FormField,
  TransactionReceipt, 
  BurnCard,
  TransactionPreviewPanel,
  buildTransactionPreviewViewModel
} from '../../components/molecules';
import { Card, Typography, Button, StatusPill } from '../../components/atoms';
import { parseMinimaAmount, formatAmount, parseTokenImageUrl } from '../../../constants';
import { useSendTransaction } from '../../../core/transaction/useSendTransaction';
import { parseDecimalToBaseUnits } from '../../../core/transaction/MinimaTransactionBuilder';
import { validateMinimaAddress } from '../../../core/validation';
import { 
  transactionAssembler, 
  type TransactionArtifact, 
  type TransactionAssemblyRequest 
} from '../../../core/transaction';
import { useUnlock } from '../contexts/UnlockContext';
import { usePortfolio } from '../../hooks';
import type { TokenDetailData } from './BrutalistTokenDetail';
import '../../theme/axia-tokens.css';

interface WalletToken {
  tokenId: string;
  tokenName: string;
  ticker?: string;
  balance: string;
  sendable?: string;
  unconfirmed?: string;
  icon?: string;
  type?: string;
}

type SendScreen = 'form' | 'review' | 'receipt';

interface BrutalistSendProps {
  initialToken?: TokenDetailData | null;
  onTokenConsumed?: () => void;
  activeAccountIndex?: number;
}

export function BrutalistSend({ initialToken, onTokenConsumed, activeAccountIndex = 0 }: BrutalistSendProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('MINIMA');
  const [selectedTokenId, setSelectedTokenId] = useState('0x00');
  const [selectedTokenName, setSelectedTokenName] = useState('MINIMA');
  const [memo, setMemo] = useState('');
  const [burnAmount, setBurnAmount] = useState('0');
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const tokenPickerButtonRef = useRef<HTMLDivElement>(null);
  const [tokenPickerPos, setTokenPickerPos] = useState({ top: 0, right: 0, width: 0 });
  const initialTokenConsumed = useRef(false);

  // Screen state for MetaMask-style flow
  const [screen, setScreen] = useState<SendScreen>('form');

  // Balance state
  const [balance, setBalance] = useState<string>('0');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [excludedAddresses, setExcludedAddresses] = useState<number[]>([]);

  const addressesRef = useRef(addresses);
  const excludedAddressesRef = useRef(excludedAddresses);
  const scannerOpenedRef = useRef(false);

  // Transaction assembly state - holds fully assembled transaction for preview
  const [transactionArtifact, setTransactionArtifact] = useState<TransactionArtifact | null>(null);
  const [assemblyLoading, setAssemblyLoading] = useState(false);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);
  
  // Unlock context for wallet unlock flow
  const { openUnlock } = useUnlock();
  
  // Handle unlock required callback
  const handleUnlockRequired = useCallback((reason: string, retryAction: () => Promise<void>) => {
    openUnlock(reason, retryAction);
  }, [openUnlock]);
  
  const addDecimalStrings = (a: string, b: string): string => {
    if (!a || a === '0' || a === '') return b || '0';
    if (!b || b === '0' || b === '') return a || '0';
    const [aInt, aDecStr = ''] = a.split('.');
    const [bInt, bDecStr = ''] = b.split('.');
    const maxDec = 18;
    const aDec = aDecStr.padEnd(maxDec, '0');
    const bDec = bDecStr.padEnd(maxDec, '0');
    const sumFull = BigInt(aInt + aDec) + BigInt(bInt + bDec);
    const sumStr = sumFull.toString().padStart(maxDec + 1, '0');
    const intPart = sumStr.slice(0, -maxDec) || '0';
    const decPart = sumStr.slice(-maxDec).replace(/0+$/, '');
    return decPart ? `${intPart}.${decPart}` : intPart;
  };

  const { entries, startStream } = usePortfolio();

  // Derive WalletToken[] from PortfolioEntry[] whenever entries change
  useEffect(() => {
    if (entries.length === 0) return;
    const native = entries.find(e => e.kind === 'native' || e.tokenid === '0x00');
    const newTokens: WalletToken[] = [
      {
        tokenId:     '0x00',
        tokenName:   'Minima',
        ticker:      'MINIMA',
        balance:     native?.total ?? native?.confirmed ?? '0',
        sendable:    native?.confirmed ?? '0',
        unconfirmed: native?.unconfirmed ?? '0',
        icon:        undefined,
        type:        'Native',
      },
      ...entries
        .filter(e => e.kind !== 'native' && e.tokenid !== '0x00')
        .map(t => ({
          tokenId:     t.tokenid,
          tokenName:   t.name || 'Unknown Token',
          ticker:      t.ticker ?? undefined,
          balance:     t.total ?? t.confirmed ?? '0',
          sendable:    t.confirmed ?? '0',
          unconfirmed: t.unconfirmed ?? '0',
          icon:        parseTokenImageUrl(t.url) || parseTokenImageUrl(t.icon),
          type:        t.kind,
        })),
    ];
    setWalletTokens(newTokens);
  }, [entries]);

  // Transaction state with extended hook - passes unlock callback
  const { 
    status: txStatus,
    stage: txStage,
    error: txError, 
    txpowid, 
    result: txResult,
    sendTransaction, 
    reset: resetTransaction,
    review: reviewTransaction,
    confirmAndSend,
    pendingParams
  } = useSendTransaction({ onUnlockRequired: handleUnlockRequired });

  useEffect(() => {
    if (initialToken && !initialTokenConsumed.current) {
      initialTokenConsumed.current = true;
      const isMinima = initialToken.tokenId === '0x00';
      setSelectedAsset(isMinima ? 'MINIMA' : (initialToken.ticker || initialToken.tokenName));
      setSelectedTokenId(initialToken.tokenId);
      setSelectedTokenName(initialToken.ticker || initialToken.tokenName);
      setBalance(initialToken.sendable ?? '0');
      onTokenConsumed?.();
    }
  }, [initialToken, onTokenConsumed]);

  useEffect(() => { addressesRef.current = addresses; }, [addresses]);
  useEffect(() => { excludedAddressesRef.current = excludedAddresses; }, [excludedAddresses]);

  useEffect(() => {
    chrome.storage.session.get(['pendingQRScan']).then((result) => {
      if (result.pendingQRScan?.address) {
        setRecipient(result.pendingQRScan.address);
        chrome.storage.session.remove('pendingQRScan');
      }
    });
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.pendingQRScan?.newValue?.address) {
        setRecipient(changes.pendingQRScan.newValue.address);
      }
    };
    chrome.storage.session.onChanged.addListener(listener);
    return () => {
      chrome.storage.session.onChanged.removeListener(listener);
      if (scannerOpenedRef.current) {
        chrome.runtime.sendMessage({ type: 'QR_DONE' }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (screen === 'receipt' && scannerOpenedRef.current) {
      chrome.runtime.sendMessage({ type: 'QR_DONE' }).catch(() => {});
      scannerOpenedRef.current = false;
    }
  }, [screen]);

  // Load wallet state on mount
  useEffect(() => {
    const load = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ method: 'wallet:getState' });
        const accounts = response?.result?.accounts || [];
        if (accounts.length > 0) {
          setAddresses(accounts);
        } else {
          const stored = await chrome.storage.local.get('walletAddresses');
          const walletAddresses = stored.walletAddresses || [];
          if (walletAddresses.length > 0) {
            setAddresses(walletAddresses);
          }
        }
        const stored = await chrome.storage.local.get(['excludedAddresses']);
        setExcludedAddresses(stored.excludedAddresses || []);
      } catch (error) {
        console.error('[BrutalistSend] Failed to load wallet state:', error);
      }
    };
    load();
  }, []);

  // Subscribe stream to the active account; re-subscribes on account switch
  useEffect(() => {
    if (addresses.length === 0) return;
    const activeAccount = addresses.find(a => a.index === activeAccountIndex) || addresses[0];
    if (!activeAccount?.address) return;
    startStream([activeAccount.address]);
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'balance:replay' }).catch(() => {});
    }, 150);
  }, [addresses, activeAccountIndex, startStream]);


  const handleSelectToken = (token: WalletToken) => {
    const isMinima = token.tokenId === '0x00';
    setSelectedAsset(isMinima ? 'MINIMA' : (token.ticker || token.tokenName));
    setSelectedTokenId(token.tokenId);
    setSelectedTokenName(token.ticker || token.tokenName);
    setShowTokenPicker(false);
    setBalance(token.sendable ?? '0');
  };

  const handleToggleTokenPicker = () => {
    if (!showTokenPicker && tokenPickerButtonRef.current) {
      const rect = tokenPickerButtonRef.current.getBoundingClientRect();
      setTokenPickerPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        width: rect.width,
      });
    }
    setShowTokenPicker(prev => !prev);
  };

  useEffect(() => {
    const token = walletTokens.find(t => t.tokenId === selectedTokenId);
    if (token) {
      setBalance(token.sendable ?? '0');
    }
    // No else: if the token isn't in the stream snapshot yet, keep the existing balance
    // (initialToken or handleSelectToken may have already set the correct value — don't
    // wipe it just because the WS snapshot didn't include this custom token's UTXOs yet)
  }, [walletTokens, selectedTokenId]);

  // Get the active account's address for transaction signing
  const getSourceAddress = (): string | undefined => {
    const account = addresses.find(acc => acc.index === activeAccountIndex) || addresses[0];
    return account?.address;
  };

  // Handle "Review" button - assemble full transaction THEN show review screen
  const handleReview = async () => {
    const sourceAddress = getSourceAddress();
    const tokenId = selectedTokenId;
    
    console.log('[BrutalistSend] Assembling transaction before review...');
    setAssemblyLoading(true);
    setAssemblyError(null);
    setTransactionArtifact(null);
    
    try {
      // Get wallet addresses and WOTS root public key
      const walletState = await chrome.runtime.sendMessage({ method: 'wallet:getState' });
      const walletAddresses = walletState.result?.accounts?.map((acc: any) => acc.address) || [];
      const wotsRootPublicKey = walletState.result?.wotsRootPublicKey || '';
      
      // Build assembly request
      const assemblyRequest: TransactionAssemblyRequest = {
        type: 'simple_send',
        recipient,
        amount,
        tokenId,
        tokenSymbol: selectedAsset,
        sourceMode: 'focused',
        sourceAddress,
        excludedAddresses: [],
        burn: burnAmount && parseFloat(burnAmount) > 0 ? burnAmount : undefined,
        walletAddresses,
        wotsRootPublicKey
      };
      
      console.log('[BrutalistSend] Calling TransactionAssembler with:', assemblyRequest);
      
      // Assemble the full transaction with coin selection and proofs
      const result = await transactionAssembler.assemble(assemblyRequest);
      
      if (!result.success || !result.artifact) {
        console.error('[BrutalistSend] Assembly failed:', result.error);
        setAssemblyError(result.error || 'Failed to assemble transaction');
        setAssemblyLoading(false);
        return;
      }
      
      console.log('[BrutalistSend] Transaction assembled successfully:', {
        inputCount: result.artifact.inputs.length,
        outputCount: result.artifact.outputs.length,
        rawHexLength: result.artifact.rawTransactionHex.length
      });
      
      setTransactionArtifact(result.artifact);
      
      // Store pending params in hook state (including burn amount)
      const amountInBaseUnits = parseMinimaAmount(amount);
      const burnBaseUnits = burnAmount && parseFloat(burnAmount) > 0 ? parseMinimaAmount(burnAmount) : undefined;
      
      reviewTransaction({
        address: recipient,
        amount: amountInBaseUnits,
        tokenid: tokenId,
        sourceAddress,
        sendMode: 'focused',
        excludedAddresses: [],
        burn: burnBaseUnits
      });
      
      setScreen('review');
      
    } catch (error) {
      console.error('[BrutalistSend] Assembly error:', error);
      setAssemblyError(error instanceof Error ? error.message : 'Failed to assemble transaction');
    } finally {
      setAssemblyLoading(false);
    }
  };

  // Handle confirmation from review screen
  const handleConfirmSend = async () => {
    console.log('[BrutalistSend] Confirming and sending transaction');
    await confirmAndSend();
  };

  // Handle cancel from review screen
  const handleCancelReview = () => {
    setScreen('form');
    resetTransaction();
    setTransactionArtifact(null);
    setAssemblyError(null);
  };

  // Handle close from receipt screen
  const handleCloseReceipt = () => {
    setScreen('form');
    resetTransaction();
    // Clear form
    setRecipient('');
    setAmount('');
    setMemo('');
    // walletTokens is derived — no manual restore needed
  };

  // Legacy handleSend for direct send (skip review)
  const handleSend = async () => {
    try {
      const amountInBaseUnits = parseMinimaAmount(amount);
      const sourceAddress = getSourceAddress();
      const burnBaseUnits = burnAmount && parseFloat(burnAmount) > 0 ? parseMinimaAmount(burnAmount) : undefined;

      console.log('[BrutalistSend] Direct send:', { 
        sourceAddress,
        recipient, 
        amount: amountInBaseUnits, 
        selectedAsset,
        burn: burnBaseUnits
      });

      await sendTransaction({
        address: recipient,
        amount: amountInBaseUnits,
        tokenid: selectedTokenId,
        sourceAddress,
        sendMode: 'focused',
        excludedAddresses: [],
        burn: burnBaseUnits
      });
      
    } catch (error) {
      console.error('[BrutalistSend] Send failed:', error);
    }
  };
  
  // Handle transaction status changes - transition to receipt screen
  useEffect(() => {
    if (txStatus === 'signing' || txStatus === 'submitting') {
      // Stay on review screen during signing/submitting
      if (screen !== 'review') setScreen('review');
    } else if (txStatus === 'pending' || txStatus === 'confirmed') {
      // Show receipt screen once submitted
      setScreen('receipt');
    } else if (txStatus === 'failed' && screen === 'review') {
      // Show error on review screen, don't auto-transition
    }
  }, [txStatus, screen]);


  // Validate recipient address with checksum verification
  const addressValidation = useMemo(() => {
    if (!recipient || recipient.trim() === '') {
      return { valid: false, reason: undefined };
    }
    return validateMinimaAddress(recipient);
  }, [recipient]);

  // Validate amount as string (display format like "0.01")
  const isValidAmount = (amt: string): boolean => {
    if (!amt || amt.trim() === '') return false;
    const parsed = parseFloat(amt);
    return !isNaN(parsed) && parsed > 0;
  };

  // Check if user has sufficient balance (using float arithmetic for display format)
  const hasSufficientBalance = (): boolean => {
    if (!isValidAmount(amount)) return false;
    try {
      const amountFloat = parseFloat(amount) || 0;
      const burnFloat = burnAmount ? parseFloat(burnAmount) || 0 : 0;
      const requiredAmount = amountFloat + burnFloat;
      const currentBalance = parseFloat(balance) || 0;
      return currentBalance >= requiredAmount;
    } catch {
      return false;
    }
  };

  const isValid = addressValidation.valid && isValidAmount(amount) && hasSufficientBalance();

  // Render Review Screen with Enhanced Transaction Preview
  if (screen === 'review' && pendingParams) {
    const isSending = txStatus === 'signing' || txStatus === 'submitting';
    
    // Derive token scale from the artifact's backing total vs the user's display amount.
    // backing_base_units × 10^scale = display_base_units
    // scale:44 → NFTs, scale:36 → fungible tokens.
    let tokenScale: number | undefined;
    const reviewTokenId = pendingParams.tokenid || '0x00';
    // 'amount' is the React state — the user's original typed value ("888").
    // pendingParams.amount has already been converted to base units and must NOT be used here.
    if (transactionArtifact && reviewTokenId !== '0x00' && amount) {
      const totalOutEntry = transactionArtifact.totalOut.find(
        t => t.tokenId.toLowerCase() === reviewTokenId.toLowerCase()
      );
      if (totalOutEntry) {
        try {
          const displayBU = parseDecimalToBaseUnits(amount);   // "888" → 888×10^44
          const backingBU = BigInt(totalOutEntry.amount);      // "88800000000" → 888×10^8
          if (backingBU > 0n && displayBU > 0n) {
            const ratio = displayBU / backingBU;
            let scale = 0;
            let r = ratio;
            while (r > 1n && scale <= 44) { r /= 10n; scale++; }
            if (scale > 0 && scale <= 44) tokenScale = scale;
          }
        } catch { /* leave tokenScale undefined */ }
      }
    }

    // Use assembled transaction artifact when available for complete preview
    const previewViewModel = buildTransactionPreviewViewModel({
      transaction: transactionArtifact?.transaction,
      scriptDescriptors: transactionArtifact?.scriptDescriptors,
      recipient: pendingParams.address,
      amount: pendingParams.amount,
      tokenSymbol: selectedAsset,
      tokenId: reviewTokenId,
      sourceAddress: pendingParams.sourceAddress,
      sourceMode: 'focused',
      burn: pendingParams.burn,
      balance: balance,
      rawTransactionHex: transactionArtifact?.rawTransactionHex,
      walletAddresses: transactionArtifact?.walletAddresses || [],
      tokenScale
    });
    
    return (
      <div style={{ minHeight: '100%' }}>
        <TransactionPreviewPanel
          viewModel={previewViewModel}
          isLoading={isSending}
          error={txError || assemblyError || undefined}
          onConfirm={handleConfirmSend}
          onCancel={handleCancelReview}
          showAdvanced={true}
        />
      </div>
    );
  }

  // Render Receipt Screen
  if (screen === 'receipt' && txpowid) {
    return (
      <TransactionReceipt
        txpowid={txpowid}
        status={txStatus === 'confirmed' ? 'confirmed' : txStatus === 'unconfirmed' ? 'unconfirmed' : txStatus === 'failed' ? 'failed' : 'pending'}
        recipient={pendingParams?.address || recipient}
        amount={pendingParams?.amount || parseMinimaAmount(amount)}
        tokenSymbol={selectedAsset}
        burn={pendingParams?.burn}
        blockHeight={txResult?.blockHeight}
        miningSource={txResult?.miningSource}
        errorMessage={txError || undefined}
        onClose={handleCloseReceipt}
      />
    );
  }

  // Render Form Screen (default)
  return (
    <div style={{
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
    <div style={{
      flex: 1,
      minHeight: 0,
      padding: 'var(--space-1) var(--space-2)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      {/* Page Header */}
      <Typography variant="h2" color="accent">
        Send
      </Typography>

      {/* Consolidated: Source + Asset + Balance */}
      <Card padding="md" style={{ borderColor: 'var(--axia-aqua)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-1)' }}>
          {/* Asset Selector */}
          <div style={{ flex: 2 }} ref={tokenPickerButtonRef}>
            <button
              onClick={handleToggleTokenPicker}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                height: '36px',
                boxSizing: 'border-box' as const,
                background: 'var(--bg-elevated)',
                border: `1px solid ${showTokenPicker ? 'var(--axia-aqua)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
                color: 'var(--text-primary)',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {(() => {
                  const currentToken = walletTokens.find(t => t.tokenId === selectedTokenId);
                  const displayIcon = currentToken?.icon;
                  const isMinima = selectedTokenId === '0x00';
                  return (
                    <>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '3px',
                        border: `1.5px solid ${isMinima ? 'var(--minima-green)' : 'var(--border-default)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isMinima ? 'rgba(0, 255, 136, 0.08)' : 'var(--bg-subtle)',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isMinima ? 'var(--minima-green)' : 'var(--text-muted)',
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative',
                      }}>
                        {isMinima ? 'M' : selectedTokenName.charAt(0).toUpperCase()}
                        {displayIcon && (
                          <img src={displayIcon} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedTokenName}
                      </div>
                    </>
                  );
                })()}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px', transition: 'transform 0.15s', transform: showTokenPicker ? 'rotate(180deg)' : 'none' }}>
                ▾
              </span>
            </button>
          </div>
        </div>

        {/* Balance Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-1)' }}>
          <Typography variant="caption" color="muted" style={{ fontSize: '10px' }}>
            Available
          </Typography>
          <Typography variant="body" color="accent" mono style={{ fontWeight: 700 }}>
            {formatAmount(balance, 4)} {selectedAsset}
          </Typography>
        </div>
        {(() => {
          const selToken = walletTokens.find(t => t.tokenId === selectedTokenId);
          const pendingAmt = parseFloat(selToken?.unconfirmed ?? '0');
          if (pendingAmt <= 0) return null;
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
              <Typography variant="caption" color="muted" style={{ fontSize: '10px' }}>
                Pending
              </Typography>
              <Typography variant="caption" color="muted" mono style={{ fontSize: '10px' }}>
                +{formatAmount(selToken!.unconfirmed!, 4)} {selectedAsset} (confirming…)
              </Typography>
            </div>
          );
        })()}
      </Card>

      {/* Recipient Address */}
      <FormField
        label="Recipient Address"
        value={recipient}
        onChange={setRecipient}
        placeholder="Mx... or 0x..."
        mono
        required
        hint=""
        error={recipient.length > 0 && !addressValidation.valid ? addressValidation.reason : undefined}
        endAdornment={
          <button
            type="button"
            onClick={() => {
              scannerOpenedRef.current = true;
              chrome.windows.create({
                url: chrome.runtime.getURL('scanner.html'),
                type: 'popup',
                width: 400,
                height: 520,
                focused: true,
              });
            }}
            title="Scan QR code"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--axia-aqua)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/>
              <rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/>
            </svg>
          </button>
        }
      />

      {/* Invalid Address Warning */}
      {recipient.length > 0 && !addressValidation.valid && addressValidation.reason && (
        <Card padding="md" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'var(--color-danger)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <Typography variant="body" color="danger" style={{ fontSize: 'var(--text-lg)' }}>
              ✗
            </Typography>
            <div>
              <Typography variant="caption" color="danger" bold uppercase>
                Invalid Address
              </Typography>
              <Typography variant="caption" color="muted" style={{ marginTop: '4px' }}>
                {addressValidation.reason}
              </Typography>
            </div>
          </div>
        </Card>
      )}

      {/* Amount */}
      <FormField
        label="Amount"
        value={amount}
        onChange={setAmount}
        type="text"
        placeholder="0.0000"
        mono
        required
        hint=""
      />

      {/* Insufficient Balance Warning */}
      {amount && isValidAmount(amount) && !hasSufficientBalance() && (
        <Card padding="md" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'var(--color-danger)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <Typography variant="body" color="danger" style={{ fontSize: 'var(--text-lg)' }}>
              ✗
            </Typography>
            <div>
              <Typography variant="caption" color="danger" bold uppercase>
                Insufficient Balance
              </Typography>
              <Typography variant="caption" color="muted" style={{ marginTop: '4px' }}>
                {(() => {
                  const selToken = walletTokens.find(t => t.tokenId === selectedTokenId);
                  const hasPending = parseFloat(selToken?.unconfirmed ?? '0') > 0;
                  return hasPending
                    ? 'Funds are pending confirmation — please wait for the transaction to confirm before sending.'
                    : 'Balance on active account is insufficient for this transaction.';
                })()}
              </Typography>
            </div>
          </div>
        </Card>
      )}

      {/* Memo (Optional) */}
      <FormField
        label="Memo (Optional)"
        value={memo}
        onChange={setMemo}
        placeholder="Optional message..."
        hint=""
      />

      {/* Burn (Optional Priority) */}
      <BurnCard
        burnAmount={burnAmount}
        onBurnChange={setBurnAmount}
        disabled={!isValidAmount(amount)}
      />

      {/* Total Summary */}
      {amount && isValidAmount(amount) && (
        <Card padding="md" style={{ background: 'rgba(0, 217, 181, 0.05)', borderColor: 'var(--axia-aqua)' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Typography variant="body" uppercase bold>
              Total{parseFloat(burnAmount || '0') > 0 ? ' (Amount + Burn)' : ''}
            </Typography>
            <Typography variant="h3" color="primary" mono>
              {(() => {
                const amountNum = parseFloat(amount) || 0;
                const burnNum = parseFloat(burnAmount || '0') || 0;
                return formatAmount((amountNum + burnNum).toString(), 8);
              })()}
            </Typography>
          </div>
        </Card>
      )}

      {/* Transaction Status Banners */}
      {txStatus === 'signing' && txStage === 'mining' && (
        <Card padding="md" style={{ background: 'rgba(139, 92, 246, 0.05)', borderColor: 'var(--axia-purple, #8b5cf6)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <Typography variant="body" style={{ fontSize: 'var(--text-lg)', color: 'var(--axia-purple, #8b5cf6)' }}>
              ⛏
            </Typography>
            <div>
              <Typography variant="caption" bold uppercase style={{ color: 'var(--axia-purple, #8b5cf6)' }}>
                Mining Transaction...
              </Typography>
              <Typography variant="caption" color="muted" style={{ marginTop: '4px' }}>
                Computing proof-of-work locally — this takes a few seconds
              </Typography>
            </div>
          </div>
        </Card>
      )}

      {txStatus === 'submitting' && (
        <Card padding="md" style={{ background: 'rgba(59, 130, 246, 0.05)', borderColor: 'var(--axia-aqua)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <Typography variant="body" color="accent" style={{ fontSize: 'var(--text-lg)' }}>
              ⟳
            </Typography>
            <div>
              <Typography variant="caption" color="accent" bold uppercase>
                Submitting Transaction...
              </Typography>
              <Typography variant="caption" color="muted" style={{ marginTop: '4px' }}>
                Preparing and signing transaction
              </Typography>
            </div>
          </div>
        </Card>
      )}

      {txStatus === 'pending' && (
        <Card padding="md" style={{ background: 'rgba(245, 158, 11, 0.05)', borderColor: 'var(--color-warning)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <Typography variant="body" color="warning" style={{ fontSize: 'var(--text-lg)' }}>
              ⏱
            </Typography>
            <div>
              <Typography variant="caption" color="warning" bold uppercase>
                Transaction Pending Confirmation
              </Typography>
              <Typography variant="caption" color="muted" style={{ marginTop: '4px' }}>
                Waiting for blockchain confirmation... (ID: {txpowid?.slice(0, 12)}...)
              </Typography>
            </div>
          </div>
        </Card>
      )}

      {txStatus === 'confirmed' && (
        <Card padding="md" style={{ background: 'rgba(34, 197, 94, 0.05)', borderColor: 'var(--color-success)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <Typography variant="body" color="success" style={{ fontSize: 'var(--text-lg)' }}>
              ✓
            </Typography>
            <div>
              <Typography variant="caption" color="success" bold uppercase>
                Transaction Confirmed
              </Typography>
              <Typography variant="caption" color="muted" style={{ marginTop: '4px' }}>
                {amount} {selectedAsset} sent successfully!
              </Typography>
            </div>
          </div>
        </Card>
      )}

      {txStatus === 'failed' && txError && (
        <Card padding="md" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'var(--color-danger)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <Typography variant="body" color="danger" style={{ fontSize: 'var(--text-lg)' }}>
              ✗
            </Typography>
            <div>
              <Typography variant="caption" color="danger" bold uppercase>
                Transaction Failed
              </Typography>
              <Typography variant="caption" color="muted" style={{ marginTop: '4px' }}>
                {txError}
              </Typography>
            </div>
          </div>
        </Card>
      )}

      {/* Review & Send Button */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!isValid || txStatus === 'submitting' || txStatus === 'pending' || txStatus === 'signing' || assemblyLoading}
        onClick={handleReview}
        style={{ marginTop: 'var(--space-1)' }}
      >
        {assemblyLoading 
          ? '⏳ Preparing Transaction...'
          : !isValid 
            ? (!recipient 
                ? 'Enter Recipient' 
                : !addressValidation.valid 
                  ? 'Invalid Address' 
                  : !isValidAmount(amount) 
                    ? 'Enter Amount' 
                    : 'Insufficient Balance')
            : '→ Review Transaction'}
      </Button>
      
      {/* Assembly Error Display */}
      {assemblyError && (
        <Card padding="sm" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--color-error)', marginTop: 'var(--space-1)' }}>
          <Typography variant="body" style={{ color: 'var(--color-error)' }}>
            {assemblyError}
          </Typography>
        </Card>
      )}

    </div>

      {/* Token Picker Overlay — fixed position, right-justified, never displaces card content */}
      {showTokenPicker && (
        <>
          {/* Backdrop — closes picker on outside click */}
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 99,
            }}
            onClick={() => setShowTokenPicker(false)}
          />
          {/* Floating token list, right-flush with the trigger button */}
          <div
            style={{
              position: 'fixed',
              top: `${tokenPickerPos.top}px`,
              right: `${tokenPickerPos.right}px`,
              width: `${tokenPickerPos.width}px`,
              zIndex: 100,
              maxHeight: '220px',
              overflowY: 'auto',
              background: 'var(--bg-base)',
              border: '2px solid var(--axia-aqua)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {walletTokens.length === 0 ? (
              <div style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
                <Typography variant="caption" color="muted">No tokens found</Typography>
              </div>
            ) : (
              walletTokens.map((token) => {
                const isMinima = token.tokenId === '0x00';
                const isSelected = token.tokenId === selectedTokenId;
                const displayName = token.ticker || token.tokenName;
                return (
                  <button
                    key={token.tokenId}
                    onClick={() => handleSelectToken(token)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      background: isSelected ? 'rgba(0, 217, 181, 0.08)' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-family)',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '3px',
                        border: `1.5px solid ${isMinima ? 'var(--minima-green)' : 'var(--border-default)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isMinima ? 'rgba(0, 255, 136, 0.08)' : 'var(--bg-subtle)',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: isMinima ? 'var(--minima-green)' : 'var(--text-muted)',
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative',
                      }}>
                        {isMinima ? 'M' : displayName.charAt(0).toUpperCase()}
                        {token.icon && (
                          <img src={token.icon} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: isSelected ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {displayName}
                          {isSelected && <span style={{ color: 'var(--axia-aqua)', marginLeft: '4px' }}>✓</span>}
                        </div>
                        {token.type === 'NFT' && (
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', padding: '0 3px', borderRadius: '2px' }}>NFT</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {formatAmount(token.sendable || token.balance, 4)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

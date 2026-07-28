/**
 * Transaction Approval Flow Modal
 * 4-stage WOTS signing flow: Lease Request → Local Signing → Witness Preview → Finalize
 */

import React, { useState, useEffect } from 'react';

export type TransactionRequest = {
  to: string;
  amount: string;
  tokenId: string;
  burn?: string;
  txId?: string;
};

export type LeaseResponse = {
  l1: number;
  l2: number;
  l3: number;
  leaseToken: string;
  digestTx: string;
};

export type WitnessBundle = {
  l1: number;
  l2: number;
  l3: number;
  signatures: {
    l1Proof: string[];
    l2Proof: string[];
    l3Proof: string[];
  };
};

type ApprovalStage = 'lease' | 'signing' | 'preview' | 'finalize' | 'success' | 'error';

interface ApprovalFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionRequest | null;
  onComplete?: (txpowid: string) => void;
}

export function ApprovalFlowModal({ isOpen, onClose, transaction, onComplete }: ApprovalFlowModalProps) {
  const [stage, setStage] = useState<ApprovalStage>('lease');
  const [leaseData, setLeaseData] = useState<LeaseResponse | null>(null);
  const [witnessBundle, setWitnessBundle] = useState<WitnessBundle | null>(null);
  const [signedHex, setSignedHex] = useState<string>('');
  const [txpowid, setTxpowid] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && transaction) {
      setStage('lease');
      setLeaseData(null);
      setWitnessBundle(null);
      setSignedHex('');
      setTxpowid('');
      setError('');
      requestLease();
    }
  }, [isOpen, transaction]);

  const requestLease = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'wallet:requestLease',
        params: transaction
      });

      if (response.error) {
        throw new Error(response.error);
      }

      setLeaseData(response.result);
      setStage('signing');
    } catch (err: any) {
      setError(err.message || 'Failed to request lease');
      setStage('error');
    } finally {
      setLoading(false);
    }
  };

  const performSigning = async () => {
    if (!leaseData) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await chrome.runtime.sendMessage({
        method: 'wallet:signTransaction',
        params: {
          l1: leaseData.l1,
          l2: leaseData.l2,
          l3: leaseData.l3,
          digestTx: leaseData.digestTx
        }
      });

      if (response.error) {
        throw new Error(response.error);
      }

      setWitnessBundle(response.result.witnessBundle);
      setSignedHex(response.result.signedHex);
      setStage('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to sign transaction');
      setStage('error');
    } finally {
      setLoading(false);
    }
  };

  const finalizeTransaction = async () => {
    if (!leaseData || !signedHex) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await chrome.runtime.sendMessage({
        method: 'wallet:finalizeTransaction',
        params: {
          leaseToken: leaseData.leaseToken,
          signedHex: signedHex
        }
      });

      if (response.error) {
        throw new Error(response.error);
      }

      setTxpowid(response.result.txpowid);
      setStage('success');
      
      if (onComplete) {
        onComplete(response.result.txpowid);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to finalize transaction');
      setStage('error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setStage('lease');
    setError('');
    requestLease();
  };

  const handleClose = () => {
    if (stage === 'success' || stage === 'error') {
      onClose();
    }
  };

  if (!isOpen || !transaction) {
    return null;
  }

  return (
    <div className="quota-modal-overlay" style={{ zIndex: 1000 }}>
      <div className="quota-modal" style={{ maxWidth: '420px' }}>
        <div className="quota-modal-header">
          <h2 style={{ fontSize: '16px' }}>
            {stage === 'lease' && 'Requesting Lease...'}
            {stage === 'signing' && 'Signing Transaction'}
            {stage === 'preview' && 'Review Transaction'}
            {stage === 'finalize' && 'Finalizing...'}
            {stage === 'success' && 'Transaction Sent!'}
            {stage === 'error' && 'Transaction Failed'}
          </h2>
        </div>

        <div className="quota-modal-body">
          {stage === 'lease' && (
            <LeaseStage transaction={transaction} loading={loading} />
          )}
          
          {stage === 'signing' && leaseData && (
            <SigningStage 
              leaseData={leaseData} 
              transaction={transaction}
              loading={loading}
              onSign={performSigning}
            />
          )}
          
          {stage === 'preview' && witnessBundle && (
            <PreviewStage 
              witnessBundle={witnessBundle}
              transaction={transaction}
              loading={loading}
              onFinalize={finalizeTransaction}
              onCancel={handleClose}
            />
          )}
          
          {stage === 'finalize' && (
            <FinalizeStage loading={loading} />
          )}
          
          {stage === 'success' && (
            <SuccessStage txpowid={txpowid} onClose={handleClose} />
          )}
          
          {stage === 'error' && (
            <ErrorStage error={error} onRetry={handleRetry} onClose={handleClose} />
          )}
        </div>
      </div>
    </div>
  );
}

function LeaseStage({ transaction, loading }: { transaction: TransactionRequest; loading: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
      <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
        Requesting WOTS lease from Axia...
      </p>
      <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--muted)' }}>
        <div>To: {transaction.to.slice(0, 12)}...{transaction.to.slice(-8)}</div>
        <div>Amount: {transaction.amount}</div>
      </div>
    </div>
  );
}

function SigningStage({ 
  leaseData, 
  transaction, 
  loading, 
  onSign 
}: { 
  leaseData: LeaseResponse; 
  transaction: TransactionRequest;
  loading: boolean;
  onSign: () => void;
}) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '13px', marginBottom: '8px' }}>Transaction Details:</p>
        <div style={{ background: 'var(--panel)', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: 'var(--muted)' }}>To:</span> {transaction.to.slice(0, 16)}...
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: 'var(--muted)' }}>Amount:</span> {transaction.amount}
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: 'var(--muted)' }}>Token:</span> {transaction.tokenId}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '13px', marginBottom: '8px' }}>Lease Indices:</p>
        <div style={{ background: 'var(--panel)', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
          <div>L1: {leaseData.l1} | L2: {leaseData.l2} | L3: {leaseData.l3}</div>
        </div>
      </div>

      <button
        onClick={onSign}
        disabled={loading}
        className="quota-upgrade-button"
        style={{ width: '100%' }}
      >
        {loading ? 'Signing...' : 'Sign Transaction'}
      </button>
    </div>
  );
}

function PreviewStage({ 
  witnessBundle, 
  transaction,
  loading,
  onFinalize,
  onCancel
}: { 
  witnessBundle: WitnessBundle;
  transaction: TransactionRequest;
  loading: boolean;
  onFinalize: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--success)' }}>
          ✓ Transaction Signed Successfully
        </p>
        <div style={{ background: 'var(--panel)', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: 'var(--muted)' }}>Witness Path:</span> L{witnessBundle.l1} → L{witnessBundle.l2} → L{witnessBundle.l3}
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: 'var(--muted)' }}>Proofs Generated:</span> 3 (90 signatures)
          </div>
          <div>
            <span style={{ color: 'var(--muted)' }}>Amount:</span> {transaction.amount}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{ 
            flex: 1, 
            padding: '10px', 
            background: 'var(--panel)', 
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'var(--text)',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          onClick={onFinalize}
          disabled={loading}
          className="quota-upgrade-button"
          style={{ flex: 2 }}
        >
          {loading ? 'Finalizing...' : 'Confirm & Send'}
        </button>
      </div>
    </div>
  );
}

function FinalizeStage({ loading }: { loading: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
      <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
        Broadcasting transaction to Minima network...
      </p>
    </div>
  );
}

function SuccessStage({ txpowid, onClose }: { txpowid: string; onClose: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
      <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
        Transaction Sent!
      </p>
      <div style={{ 
        background: 'var(--panel)', 
        padding: '12px', 
        borderRadius: '6px', 
        fontSize: '11px',
        marginBottom: '16px',
        wordBreak: 'break-all'
      }}>
        <div style={{ color: 'var(--muted)', marginBottom: '4px' }}>TXPOWID:</div>
        <div style={{ fontFamily: 'monospace' }}>{txpowid}</div>
      </div>
      <button
        onClick={onClose}
        className="quota-upgrade-button"
        style={{ width: '100%' }}
      >
        Done
      </button>
    </div>
  );
}

function ErrorStage({ error, onRetry, onClose }: { error: string; onRetry: () => void; onClose: () => void }) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '48px', color: 'var(--danger)', marginBottom: '12px' }}>✗</div>
        <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
          Transaction Failed
        </p>
        <div style={{ 
          background: 'var(--panel)', 
          padding: '12px', 
          borderRadius: '6px', 
          fontSize: '12px',
          color: 'var(--danger)',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onClose}
          style={{ 
            flex: 1, 
            padding: '10px', 
            background: 'var(--panel)', 
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'var(--text)',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
        <button
          onClick={onRetry}
          className="quota-upgrade-button"
          style={{ flex: 1 }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

/**
 * VerifyConfirmation Component
 * Shows verification challenge details before signing
 * Displays: site origin, challenge message, address, expiry, and risk indicators
 */

import React, { useState, useMemo } from 'react';
import type { VerifyChallenge } from '../../core/verify/ChallengeBuilder';

export interface VerifyConfirmationProps {
  challenge: VerifyChallenge;
  rawMessage: string;
  addressIndex: number;
  minimaAddress: string;
  onConfirm: () => void;
  onReject: () => void;
  loading?: boolean;
}

export function VerifyConfirmation({
  challenge,
  rawMessage,
  addressIndex,
  minimaAddress,
  onConfirm,
  onReject,
  loading = false
}: VerifyConfirmationProps) {
  const [showRaw, setShowRaw] = useState(false);

  const timeRemaining = useMemo(() => {
    const remaining = challenge.expiresAt - Date.now();
    if (remaining <= 0) return 'EXPIRED';
    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }, [challenge.expiresAt]);

  const isExpired = challenge.expiresAt <= Date.now();

  const formatAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

  const riskLevel = useMemo(() => {
    if (isExpired) return 'high';
    if (!challenge.domain.startsWith('https://')) return 'medium';
    return 'low';
  }, [challenge, isExpired]);

  const riskColor = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#ef4444'
  }[riskLevel];

  return (
    <div className="verify-confirmation">
      <style>{`
        .verify-confirmation {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          background: #000;
          border: 2px solid #fff;
          padding: 16px;
          max-width: 400px;
        }
        .verify-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #333;
        }
        .verify-icon {
          width: 40px;
          height: 40px;
          background: #1a1a1a;
          border: 2px solid #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .verify-title {
          flex: 1;
        }
        .verify-title h3 {
          color: #fff;
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin: 0 0 4px 0;
        }
        .verify-title p {
          color: #888;
          font-size: 11px;
          margin: 0;
        }
        .verify-domain {
          background: rgba(0, 255, 0, 0.1);
          border: 1px solid #0f0;
          padding: 10px;
          margin-bottom: 12px;
        }
        .verify-domain-label {
          color: #888;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 4px;
        }
        .verify-domain-value {
          color: #0f0;
          font-size: 12px;
          word-break: break-all;
        }
        .verify-info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #222;
        }
        .verify-info-label {
          color: #888;
          font-size: 11px;
        }
        .verify-info-value {
          color: #fff;
          font-size: 11px;
          text-align: right;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .verify-address {
          font-family: monospace;
          background: #111;
          padding: 10px;
          margin: 12px 0;
          border: 1px solid #333;
        }
        .verify-address-label {
          color: #888;
          font-size: 10px;
          margin-bottom: 4px;
        }
        .verify-address-value {
          color: #fff;
          font-size: 11px;
          word-break: break-all;
        }
        .verify-address-index {
          color: #0f0;
          font-size: 10px;
          margin-top: 4px;
        }
        .verify-expiry {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: ${isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'};
          border: 1px solid ${isExpired ? '#ef4444' : '#22c55e'};
          margin-bottom: 12px;
        }
        .verify-expiry-icon {
          font-size: 14px;
        }
        .verify-expiry-text {
          color: ${isExpired ? '#ef4444' : '#22c55e'};
          font-size: 11px;
        }
        .verify-risk {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: rgba(${riskLevel === 'low' ? '34, 197, 94' : riskLevel === 'medium' ? '245, 158, 11' : '239, 68, 68'}, 0.1);
          border: 1px solid ${riskColor};
          margin-bottom: 12px;
        }
        .verify-risk-label {
          color: ${riskColor};
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .verify-risk-text {
          color: #888;
          font-size: 10px;
          flex: 1;
        }
        .verify-raw-toggle {
          color: #666;
          font-size: 10px;
          cursor: pointer;
          text-decoration: underline;
          margin-bottom: 8px;
        }
        .verify-raw-toggle:hover {
          color: #fff;
        }
        .verify-raw-message {
          background: #111;
          border: 1px solid #333;
          padding: 8px;
          font-size: 10px;
          color: #888;
          max-height: 100px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-all;
          margin-bottom: 12px;
        }
        .verify-warning {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid #f59e0b;
          padding: 10px;
          margin-bottom: 12px;
        }
        .verify-warning-text {
          color: #f59e0b;
          font-size: 11px;
          line-height: 1.4;
        }
        .verify-actions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }
        .verify-btn {
          flex: 1;
          padding: 12px;
          font-family: inherit;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          cursor: pointer;
          border: 2px solid #fff;
          transition: all 0.1s;
        }
        .verify-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .verify-btn-reject {
          background: transparent;
          color: #fff;
        }
        .verify-btn-reject:hover:not(:disabled) {
          background: #333;
        }
        .verify-btn-confirm {
          background: #0f0;
          color: #000;
          border-color: #0f0;
        }
        .verify-btn-confirm:hover:not(:disabled) {
          background: #00cc00;
        }
        .verify-leaf-warning {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid #f59e0b;
          padding: 8px;
          margin-bottom: 12px;
          font-size: 10px;
          color: #f59e0b;
        }
      `}</style>

      <div className="verify-header">
        <div className="verify-icon">🔐</div>
        <div className="verify-title">
          <h3>Sign Message</h3>
          <p>Verify your wallet ownership</p>
        </div>
      </div>

      <div className="verify-domain">
        <div className="verify-domain-label">Requesting Site</div>
        <div className="verify-domain-value">{challenge.domain}</div>
      </div>

      <div className="verify-expiry">
        <span className="verify-expiry-icon">{isExpired ? '⚠️' : '⏱️'}</span>
        <span className="verify-expiry-text">
          {isExpired ? 'Challenge expired - request a new one' : `Expires in ${timeRemaining}`}
        </span>
      </div>

      {riskLevel !== 'low' && (
        <div className="verify-risk">
          <span className="verify-risk-label">{riskLevel} risk</span>
          <span className="verify-risk-text">
            {riskLevel === 'high' 
              ? 'Challenge has expired or is invalid'
              : 'Non-HTTPS site - verify the URL carefully'}
          </span>
        </div>
      )}

      <div className="verify-address">
        <div className="verify-address-label">Signing Address</div>
        <div className="verify-address-value">{minimaAddress}</div>
        <div className="verify-address-index">Index #{addressIndex}</div>
      </div>

      <div className="verify-info-row">
        <span className="verify-info-label">Nonce</span>
        <span className="verify-info-value">{challenge.nonce.slice(0, 16)}...</span>
      </div>

      <div className="verify-info-row">
        <span className="verify-info-label">Issued</span>
        <span className="verify-info-value">
          {new Date(challenge.issuedAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="verify-leaf-warning">
        ⚠️ This action consumes one WOTS signature leaf from your wallet
      </div>

      <div 
        className="verify-raw-toggle"
        onClick={() => setShowRaw(!showRaw)}
      >
        {showRaw ? 'Hide' : 'Show'} raw message
      </div>

      {showRaw && (
        <div className="verify-raw-message">
          {rawMessage}
        </div>
      )}

      <div className="verify-actions">
        <button 
          className="verify-btn verify-btn-reject"
          onClick={onReject}
          disabled={loading}
        >
          Reject
        </button>
        <button 
          className="verify-btn verify-btn-confirm"
          onClick={onConfirm}
          disabled={loading || isExpired}
        >
          {loading ? 'Signing...' : 'Sign'}
        </button>
      </div>
    </div>
  );
}

export default VerifyConfirmation;

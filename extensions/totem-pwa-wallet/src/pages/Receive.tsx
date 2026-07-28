import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useWallet } from '../core/WalletContext';

export function Receive() {
  const { activeAccount, setRoute } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const address = activeAccount?.address ?? '';

  useEffect(() => {
    if (!canvasRef.current || !address) return;
    QRCode.toCanvas(canvasRef.current, address, {
      width: 240,
      margin: 2,
      color: { dark: '#00D9B5', light: '#0f172a' },
    }).catch(() => {});
  }, [address]);

  async function copyAddress() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-secondary btn-sm" onClick={() => setRoute('home')}>←</button>
        <h2 className="page-title">Receive</h2>
      </div>
      <div style={{ paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{
          background: 'var(--bg-elevated)',
          border: '2px solid var(--border-accent)',
          padding: 'var(--space-2)',
          boxShadow: 'var(--shadow-accent)',
        }}>
          <canvas ref={canvasRef} />
        </div>
        <div style={{ width: '100%' }}>
          <p className="label">Your Address</p>
          <div style={{
            fontFamily: 'var(--font-family-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            wordBreak: 'break-all',
            padding: 'var(--space-1-5)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-2)',
          }}>
            {address}
          </div>
          <button className="btn btn-primary btn-full" onClick={copyAddress}>
            {copied ? '✓ Copied!' : 'Copy Address'}
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center' }}>
          Only send Minima tokens to this address
        </p>
      </div>
    </div>
  );
}

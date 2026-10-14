import React, { useEffect, useState } from 'react';
import {
  subscribeOmniaApproval,
  getPendingOmniaApproval,
  resolveOmniaApproval,
} from '../core/omniaHost';
import type { WalletApprovalRequest } from '@totemsdk/omnia-relay';

const LABELS: Record<string, { label: string; caption: string }> = {
  'splice-accept': { label: 'Splice Acceptance', caption: 'Co-sign a channel splice proposed by a peer.' },
  'factory-open': { label: 'Factory Opening', caption: 'Co-sign the N-of-N opening of a channel factory.' },
  'factory-close': { label: 'Factory Settlement', caption: 'Co-sign a cooperative factory settlement.' },
  'vc-open': { label: 'Virtual Channel Open', caption: 'Co-sign a virtual-channel opening within a factory.' },
};

export function OmniaCoordinationApproval() {
  const [req, setReq] = useState<WalletApprovalRequest | null>(getPendingOmniaApproval());

  useEffect(() => subscribeOmniaApproval(() => setReq(getPendingOmniaApproval())), []);

  if (!req) return null;
  const info = LABELS[req.kind] ?? { label: req.kind, caption: 'A peer is requesting a channel operation.' };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#111',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: 12,
          padding: 20,
          width: 'min(92vw, 400px)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{info.label}</h2>
        <p style={{ fontSize: 12, color: '#f59e0b', margin: '0 0 12px' }}>
          Approving makes your wallet sign this operation with its WOTS key.
        </p>
        <p style={{ fontSize: 13, color: '#aaa', margin: '0 0 12px' }}>{info.caption}</p>
        <dl style={{ fontSize: 12, margin: '0 0 16px' }}>
          {req.channelId ? (<><dt style={{ color: '#888' }}>Channel</dt><dd style={{ margin: '0 0 6px', wordBreak: 'break-all' }}>{req.channelId}</dd></>) : null}
          {req.factoryId ? (<><dt style={{ color: '#888' }}>Factory</dt><dd style={{ margin: '0 0 6px', wordBreak: 'break-all' }}>{req.factoryId}</dd></>) : null}
          {req.spliceId ? (<><dt style={{ color: '#888' }}>Splice</dt><dd style={{ margin: '0 0 6px', wordBreak: 'break-all' }}>{req.spliceId}</dd></>) : null}
          {req.proposer ? (<><dt style={{ color: '#888' }}>Requested by</dt><dd style={{ margin: '0 0 6px', wordBreak: 'break-all' }}>{req.proposer}</dd></>) : null}
        </dl>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => resolveOmniaApproval(false)}
            style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', cursor: 'pointer' }}
          >
            Reject
          </button>
          <button
            onClick={() => resolveOmniaApproval(true)}
            style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #00D9B5', background: '#00D9B5', color: '#000', fontWeight: 600, cursor: 'pointer' }}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import {
  NFT_RARITY_TIERS,
  VINTAGE_META,
  VINTAGE_ORDER,
  type VintageTier,
} from '../../../core/tokenVintage';

interface EraInfoModalProps {
  open: boolean;
  onClose: () => void;
  currentTier?: VintageTier | null;
}

export function EraInfoModal({ open, onClose, currentTier }: EraInfoModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.68)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="era-info-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          maxHeight: '86vh',
          overflowY: 'auto',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '4px',
          padding: '16px',
          color: 'var(--text-primary)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h2 id="era-info-title" style={{ margin: 0, fontSize: '16px', letterSpacing: '0.02em' }}>
              Token eras &amp; rarity
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Era is based on the token's mint date. Older eras are rarer because fewer tokens existed then.
              Era is provenance, not a price prediction.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close era information"
            style={{
              background: 'none',
              border: '1px solid var(--border-subtle)',
              borderRadius: '2px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
              padding: '3px 7px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: '14px' }}>
          {VINTAGE_ORDER.map((tier) => {
            const meta = VINTAGE_META[tier];
            const current = tier === currentTier;
            return (
              <div
                key={tier}
                style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '10px 8px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: current ? 'var(--bg-subtle)' : 'transparent',
                  borderRadius: current ? '2px' : 0,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: meta.color,
                    border: '1px solid rgba(255,255,255,0.25)',
                    flexShrink: 0,
                    marginTop: '4px',
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ color: meta.color, fontSize: '12px', letterSpacing: '0.06em' }}>{meta.label}</strong>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{meta.period}</span>
                    {current && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          color: 'var(--minima-green)',
                          border: '1px solid var(--minima-green)',
                          borderRadius: '999px',
                          padding: '0 5px',
                        }}
                      >
                        CURRENT
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                    {meta.description}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: '10px', lineHeight: 1.4, color: 'var(--text-muted)' }}>
                    {meta.rarity}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            NFT rarity by supply
          </h3>
          <p style={{ margin: '4px 0 8px', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            For NFTs, the badge also reflects how many editions exist. Supply rarity is separate from era.
          </p>
          {NFT_RARITY_TIERS.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '4px 0',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: '10px',
              }}
            >
              <span style={{ fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ color: 'var(--text-muted)' }}>{row.detail}</span>
            </div>
          ))}
        </div>

        <p style={{ margin: '14px 0 0', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          Era is shown only when the token's mint block or timestamp can be resolved. If the archive cannot
          find it, no era badge is displayed.
        </p>
      </div>
    </div>
  );
}

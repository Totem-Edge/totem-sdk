import React, { useState } from 'react';
import { VINTAGE_META, type VintageTier } from '../core/tokenVintage';

interface EraBadgeProps {
  tier: VintageTier;
  onClick: () => void;
}

/** A clickable era chip with a "What's this?" hover tooltip. */
export function EraBadge({ tier, onClick }: EraBadgeProps) {
  const meta = VINTAGE_META[tier];
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

  const showTip = (e: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTip({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 226)),
    });
  };
  const hideTip = () => setTip(null);

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        title="What's this? Token era is based on the mint date. Click to see all eras and rarity."
        aria-label={`${meta.label} era, ${meta.period}. What's this? Click to see all eras and rarity.`}
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.08em',
          padding: '1px 6px',
          borderRadius: 999,
          border: `1px solid ${meta.color}`,
          color: meta.color,
          background: 'transparent',
          fontFamily: 'var(--font-family-mono)',
          cursor: 'pointer',
          lineHeight: 1.4,
          textDecoration: 'underline dotted',
          textUnderlineOffset: 2,
        }}
      >
        {meta.label}
      </button>
      {tip && (
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            top: tip.top,
            left: tip.left,
            zIndex: 1000,
            width: 210,
            padding: '6px 8px',
            borderRadius: 4,
            background: 'var(--bg-elevated, #151820)',
            border: '1px solid var(--border-subtle, #2a2f3a)',
            color: 'var(--text-primary, #f5f7fa)',
            fontSize: 10,
            lineHeight: 1.35,
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 2 }}>What's this?</strong>
          Token era is based on when the token was minted. Older eras are rarer. Click for all eras and rarity.
        </span>
      )}
    </span>
  );
}

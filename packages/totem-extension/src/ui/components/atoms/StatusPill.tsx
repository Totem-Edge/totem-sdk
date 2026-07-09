/**
 * AXIA BRUTALIST STATUS PILL
 * Flat badge component for transaction/connection states
 */

import React from 'react';
import '../../theme/axia-tokens.css';

export type StatusVariant = 'success' | 'pending' | 'failed' | 'warning' | 'info' | 'neutral';

export interface StatusPillProps {
  variant: StatusVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

export function StatusPill({ variant, children, size = 'sm' }: StatusPillProps) {
  const variantStyles: Record<StatusVariant, React.CSSProperties> = {
    success: {
      color: 'var(--color-success)',
      borderColor: 'var(--color-success)',
      background: 'rgba(34, 197, 94, 0.1)',
    },
    pending: {
      color: 'var(--color-warning)',
      borderColor: 'var(--color-warning)',
      background: 'rgba(245, 158, 11, 0.1)',
    },
    failed: {
      color: 'var(--color-danger)',
      borderColor: 'var(--color-danger)',
      background: 'rgba(239, 68, 68, 0.1)',
    },
    warning: {
      color: 'var(--color-warning)',
      borderColor: 'var(--color-warning)',
      background: 'rgba(245, 158, 11, 0.1)',
    },
    info: {
      color: 'var(--color-info)',
      borderColor: 'var(--color-info)',
      background: 'rgba(59, 130, 246, 0.1)',
    },
    neutral: {
      color: 'var(--text-muted)',
      borderColor: 'var(--border-default)',
      background: 'var(--bg-subtle)',
    },
  };

  const sizeStyles = size === 'sm' ? {
    padding: '2px 6px',
    fontSize: 'var(--text-2xs)',
  } : {
    padding: 'var(--space-half) var(--space-1)',
    fontSize: 'var(--text-xs)',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid',
        fontWeight: 'var(--weight-medium)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-wide)',
        borderRadius: 'var(--radius)', // Always 0
        ...variantStyles[variant],
        ...sizeStyles,
      }}
    >
      {children}
    </span>
  );
}

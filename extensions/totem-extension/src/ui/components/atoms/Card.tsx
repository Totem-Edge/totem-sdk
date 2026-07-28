/**
 * AXIA BRUTALIST CARD
 * Flat panel with geometric shadow, zero border-radius
 */

import React from 'react';
import '../../theme/axia-tokens.css';

export interface CardProps {
  children: React.ReactNode;
  shadow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  clickable?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({
  children,
  shadow = false,
  padding = 'md',
  clickable = false,
  onClick,
  className = '',
  style = {},
}: CardProps) {
  const paddingStyles = {
    none: { padding: 0 },
    sm: { padding: 'var(--space-1)' },
    md: { padding: 'var(--space-2)' },
    lg: { padding: 'var(--space-3)' },
  };

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius)', // Always 0
        boxShadow: shadow ? 'var(--shadow-md)' : 'none',
        cursor: clickable ? 'pointer' : 'default',
        transition: clickable ? 'all var(--transition-fast)' : 'none',
        ...paddingStyles[padding],
        ...style,
      }}
      className={className}
      onMouseEnter={(e) => {
        if (clickable) {
          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
          e.currentTarget.style.borderColor = 'var(--border-accent)';
        }
      }}
      onMouseLeave={(e) => {
        if (clickable) {
          e.currentTarget.style.boxShadow = shadow ? 'var(--shadow-md)' : 'none';
          e.currentTarget.style.borderColor = 'var(--border-default)';
        }
      }}
    >
      {children}
    </div>
  );
}

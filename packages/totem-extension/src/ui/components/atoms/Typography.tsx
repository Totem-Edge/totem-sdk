/**
 * AXIA BRUTALIST TYPOGRAPHY
 * UPPERCASE headings, high contrast, geometric spacing
 */

import React from 'react';
import '../../theme/axia-tokens.css';

export type TypographyVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'mono';
export type TypographyColor = 'primary' | 'secondary' | 'muted' | 'disabled' | 'accent' | 'success' | 'danger' | 'warning';

export interface TypographyProps {
  variant?: TypographyVariant;
  color?: TypographyColor;
  uppercase?: boolean;
  bold?: boolean;
  mono?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'label';
}

export function Typography({
  variant = 'body',
  color = 'primary',
  uppercase = false,
  bold = false,
  mono = false,
  children,
  className = '',
  style = {},
  as,
}: TypographyProps) {
  const variantStyles: Record<TypographyVariant, React.CSSProperties> = {
    h1: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--weight-bold)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      lineHeight: 1.2,
    },
    h2: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--weight-semibold)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      lineHeight: 1.3,
    },
    h3: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--weight-semibold)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      lineHeight: 1.4,
    },
    body: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-normal)',
      lineHeight: 1.5,
    },
    caption: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-normal)',
      lineHeight: 1.4,
    },
    mono: {
      fontSize: 'var(--text-sm)',
      fontFamily: 'var(--font-family-mono)',
      fontWeight: 'var(--weight-normal)',
      lineHeight: 1.5,
    },
  };

  const colorStyles: Record<TypographyColor, React.CSSProperties> = {
    primary: { color: 'var(--text-primary)' },
    secondary: { color: 'var(--text-secondary)' },
    muted: { color: 'var(--text-muted)' },
    disabled: { color: 'var(--text-disabled)' },
    accent: { color: 'var(--axia-aqua)' },
    success: { color: 'var(--color-success)' },
    danger: { color: 'var(--color-danger)' },
    warning: { color: 'var(--color-warning)' },
  };

  const combinedStyles: React.CSSProperties = {
    ...variantStyles[variant],
    ...colorStyles[color],
    ...(uppercase ? { textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' } : {}),
    ...(bold ? { fontWeight: 'var(--weight-bold)' } : {}),
    ...(mono ? { fontFamily: 'var(--font-family-mono)' } : {}),
    ...style,
  };

  // Determine which element to render
  const Component = as || (variant === 'h1' || variant === 'h2' || variant === 'h3' ? variant : 'div');

  return (
    <Component style={combinedStyles} className={className}>
      {children}
    </Component>
  );
}

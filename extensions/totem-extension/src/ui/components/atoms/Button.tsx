/**
 * AXIA BRUTALIST BUTTON
 * Flat, geometric, zero border-radius
 */

import React from 'react';
import '../../theme/axia-tokens.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-1)',
    fontFamily: 'var(--font-family)',
    fontWeight: 'var(--weight-medium)',
    textTransform: 'uppercase' as const,
    letterSpacing: 'var(--tracking-wide)',
    border: '2px solid',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all var(--transition-fast)',
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? '100%' : 'auto',
    borderRadius: 'var(--radius)', // Always 0
  };

  // Variant styles
  // Primary button: accent background with contrasting text (use bg-base for contrast)
  const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: 'var(--axia-aqua)',
      color: 'var(--bg-base)',  // Contrasts with accent - black text on white bg in mono
      borderColor: 'var(--axia-aqua)',
      boxShadow: disabled ? 'none' : 'var(--shadow-md)',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--text-primary)',
      borderColor: 'var(--border-default)',
      boxShadow: 'none',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      borderColor: 'transparent',
      boxShadow: 'none',
    },
    danger: {
      background: 'transparent',
      color: 'var(--color-danger)',
      borderColor: 'var(--color-danger)',
      boxShadow: 'none',
    },
  };

  // Size styles
  const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
    sm: {
      padding: 'var(--space-half) var(--space-1-5)',
      fontSize: 'var(--text-xs)',
    },
    md: {
      padding: 'var(--space-1) var(--space-2)',
      fontSize: 'var(--text-sm)',
    },
    lg: {
      padding: 'var(--space-1-5) var(--space-3)',
      fontSize: 'var(--text-base)',
    },
  };

  // Hover styles (applied via inline style object doesn't work, so we use CSS classes)
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;

  return (
    <>
      <style>{`
        .btn-primary:not(:disabled):hover {
          background: var(--bg-base);
          color: var(--axia-aqua);
          border-color: var(--axia-aqua);
          box-shadow: var(--shadow-lg);
        }
        
        .btn-secondary:not(:disabled):hover {
          background: var(--bg-subtle);
          border-color: var(--border-strong);
        }
        
        .btn-ghost:not(:disabled):hover {
          background: var(--bg-subtle);
          color: var(--text-primary);
        }
        
        .btn-danger:not(:disabled):hover {
          background: var(--color-danger);
          color: var(--axia-white);
          box-shadow: var(--shadow-md);
        }
      `}</style>
      <button
        style={{
          ...baseStyles,
          ...variantStyles[variant],
          ...sizeStyles[size],
        }}
        className={`${variantClass} ${sizeClass} ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    </>
  );
}

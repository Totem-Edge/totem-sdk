/**
 * AXIA FORM FIELD
 * Input field with label, error, and hint text
 */

import React from 'react';
import { Typography } from '../atoms';
import '../../theme/axia-tokens.css';

export interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'password' | 'email';
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  mono?: boolean;
  endAdornment?: React.ReactNode;
}

export function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  hint,
  disabled = false,
  required = false,
  mono = false,
  endAdornment,
}: FormFieldProps) {
  const hasError = !!error;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-half)' }}>
      {/* Label */}
      <label>
        <Typography 
          variant="caption" 
          color={hasError ? 'danger' : 'muted'} 
          uppercase
          as="span"
        >
          {label}
          {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
        </Typography>
      </label>

      {/* Input wrapper */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%',
            padding: 'var(--space-1-5)',
            paddingRight: endAdornment ? '40px' : 'var(--space-1-5)',
            fontSize: 'var(--text-base)',
            fontFamily: mono ? 'var(--font-family-mono)' : 'var(--font-family)',
            fontWeight: 'var(--weight-normal)',
            color: 'var(--text-primary)',
            background: disabled ? 'var(--bg-subtle)' : 'var(--bg-base)',
            border: `2px solid ${hasError ? 'var(--color-danger)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius)',
            outline: 'none',
            transition: 'border-color var(--transition-fast)',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
          onFocus={(e) => {
            if (!hasError && !disabled) {
              e.currentTarget.style.borderColor = 'var(--axia-aqua)';
            }
          }}
          onBlur={(e) => {
            if (!hasError) {
              e.currentTarget.style.borderColor = 'var(--border-default)';
            }
          }}
        />
        {endAdornment && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}>
            {endAdornment}
          </div>
        )}
      </div>

      {/* Error or Hint */}
      {error && (
        <Typography variant="caption" color="danger">
          {error}
        </Typography>
      )}
      {!error && hint && (
        <Typography variant="caption" color="muted">
          {hint}
        </Typography>
      )}
    </div>
  );
}

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  className = '',
  ...props
}) => {
  const inputClasses = `input ${error ? 'input-error' : ''} ${className}`;
  
  return (
    <div className="input-group">
      {label && (
        <label className="input-label text-sm text-secondary">
          {label}
        </label>
      )}
      <input className={inputClasses} {...props} />
      {error && (
        <span className="input-error-text text-xs text-danger">
          {error}
        </span>
      )}
      {hint && !error && (
        <span className="input-hint text-xs text-muted">
          {hint}
        </span>
      )}
    </div>
  );
};
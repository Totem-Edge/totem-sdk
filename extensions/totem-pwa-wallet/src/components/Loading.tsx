import React from 'react';
import { TotemEagleMark } from './TotemEagleMark';

export function Loading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-2)',
      padding: 'var(--space-4)',
    }}>
      <div style={{
        color: 'var(--axia-aqua)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>
        <TotemEagleMark size={56} color="currentColor" />
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{message}</p>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

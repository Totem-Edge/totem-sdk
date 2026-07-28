import React from 'react';

export interface BrutalistNotificationProps {
  type: 'error' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
  show: boolean;
}

export const BrutalistNotification: React.FC<BrutalistNotificationProps> = ({
  type,
  title,
  message,
  onClose,
  show
}) => {
  if (!show) return null;

  const colorMap = {
    error: 'var(--accent-primary)',
    success: '#4ADE80',
    warning: '#00D9B5',
    info: 'var(--text-secondary)'
  };

  const bgColorMap = {
    error: 'var(--bg-card)',
    success: 'var(--bg-card)',
    warning: 'var(--bg-card)',
    info: 'var(--bg-card)'
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
        padding: 'var(--space-2)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: bgColorMap[type],
          border: `2px solid ${colorMap[type]}`,
          boxShadow: `4px 4px 0 ${colorMap[type]}`,
          padding: 'var(--space-3)',
          maxWidth: '400px',
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-2)',
            borderBottom: `1px solid ${colorMap[type]}`,
            paddingBottom: 'var(--space-1)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: colorMap[type],
            }}
          >
            {type === 'error' && '⚠ ERROR'}
            {type === 'success' && '✓ SUCCESS'}
            {type === 'warning' && '⚡ WARNING'}
            {type === 'info' && 'ℹ INFO'}
          </div>
        </div>

        {/* TITLE */}
        <h3
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            margin: '0 0 var(--space-2) 0',
          }}
        >
          {title}
        </h3>

        {/* MESSAGE */}
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            margin: '0 0 var(--space-3) 0',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {message}
        </p>

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: 'var(--space-2)',
            background: colorMap[type],
            border: 'none',
            boxShadow: '2px 2px 0 rgba(0, 0, 0, 0.3)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: type === 'error' || type === 'warning' ? '#000' : '#FFF',
            cursor: 'pointer',
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translate(2px, 2px)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translate(0, 0)';
            e.currentTarget.style.boxShadow = '2px 2px 0 rgba(0, 0, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translate(0, 0)';
            e.currentTarget.style.boxShadow = '2px 2px 0 rgba(0, 0, 0, 0.3)';
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
};

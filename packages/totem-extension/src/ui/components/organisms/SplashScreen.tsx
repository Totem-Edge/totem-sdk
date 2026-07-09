/**
 * TOTEM SPLASH SCREEN
 * Shows combined eagle head + wordmark logo during app initialization
 * Displayed before wallet init/password prompt
 */
import React from 'react';

interface SplashScreenProps {
  isLoading?: boolean;
  onAnimationEnd?: () => void;
}

function TotemCombinedLogo({ width = 160 }: { width?: number }) {
  const aspectRatio = 568.56 / 470.29;
  return (
    <svg 
      width={width} 
      height={width * aspectRatio} 
      viewBox="0 0 470.29 568.56" 
      fill="var(--text-primary, #FAFAFA)"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Totem"
    >
      <polygon points="196.74 123.44 263.51 123.44 263.51 98.46 192.13 98.46 196.74 123.44"/>
      <path d="M373.23,82.43h-30.73c-8.64-29.41-35.86-50.95-68.03-50.95h-132.71c-65.93,0-119.57,53.64-119.57,119.57v195.5h361.31l-87.98-119.58,13.45-32.96h98.43l40.7,25.63v-62.34c0-41.28-33.59-74.87-74.87-74.87ZM267.08,230.5l66.99,91.05h-178.85v-85.4h-25v85.4H47.19v-170.5c0-52.15,42.42-94.57,94.57-94.57h132.71c24.54,0,44.64,19.35,45.85,43.59l-53.24,130.42ZM423.1,174.35l-8.48-5.34h-95.44l25.14-61.58h28.91c27.5,0,49.87,22.37,49.87,49.87v17.05Z"/>
      <polygon points="22.19 400.58 39.46 400.58 39.46 537.08 62.74 537.08 62.74 400.58 80 400.58 80 378.7 22.19 378.7 22.19 400.58"/>
      <path d="M131.99,378.7h-23.28c-12.85,0-19.27,8.63-19.27,25.89v106.79c0,17.13,6.42,25.69,19.27,25.69h23.28c13.11,0,19.67-8.56,19.67-25.69v-106.79c0-17.26-6.56-25.89-19.67-25.89ZM128.58,507.97c0,4.95-1.68,7.43-5.02,7.43h-6.02c-3.48,0-5.22-2.47-5.22-7.43v-99.96c0-4.95,1.74-7.43,5.22-7.43h6.02c3.34,0,5.02,2.48,5.02,7.43v99.96Z"/>
      <polygon points="161.1 400.58 178.36 400.58 178.36 537.08 201.65 537.08 201.65 400.58 218.91 400.58 218.91 378.7 161.1 378.7 161.1 400.58"/>
      <path d="M230.35,387.93v139.91c0,6.16,3.08,9.23,9.23,9.23h38.94v-21.68h-23.28c-1.34,0-2.01-.73-2.01-2.21v-45.77h25.29v-21.08h-25.29v-43.56c0-1.47.67-2.21,2.01-2.21h23.28v-21.88h-38.94c-6.16,0-9.23,3.08-9.23,9.23Z"/>
      <path d="M364.24,378.7h-65.64c-4.55,0-6.83,2.28-6.83,6.82v151.55h22.28v-135.09c0-.93.47-1.41,1.41-1.41h11.84v136.5h21.08v-136.5h8.03c3.48,0,5.22,2.48,5.22,7.43v129.07h21.88v-132.48c0-17.26-6.42-25.89-19.27-25.89Z"/>
    </svg>
  );
}

export function SplashScreen({ isLoading = true, onAnimationEnd }: SplashScreenProps) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '100vh',
      background: 'var(--bg-base, #0A0A0A)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: isLoading ? 1 : 0,
      transition: 'opacity 0.3s ease-out',
    }}
    onTransitionEnd={!isLoading ? onAnimationEnd : undefined}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        animation: 'splashFadeIn 0.5s ease-out',
      }}>
        <TotemCombinedLogo width={140} />
        
        <p style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          color: 'var(--text-muted, #6B7280)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          margin: 0,
          marginTop: '8px',
        }}>
          Quantum-Resistant Wallet
        </p>
        
        {isLoading && (
          <div style={{
            marginTop: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: 'var(--accent, #00D4AA)',
              animation: 'splashPulse 1s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              color: 'var(--text-muted, #6B7280)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Initializing
            </span>
          </div>
        )}
      </div>
      
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: 0,
        right: 0,
        textAlign: 'center',
      }}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          color: 'var(--text-muted, #6B7280)',
          opacity: 0.5,
        }}>
          v1.0.0
        </span>
      </div>

      <style>{`
        @keyframes splashFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes splashPulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}

export default SplashScreen;

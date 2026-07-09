/**
 * AddressGenerationStatus - Thin status footer for background address generation
 * Shows progress during generation, slides away and disappears when complete
 */

import React, { useEffect, useState } from 'react';

interface GenerationState {
  active: boolean;
  current: number;
  total: number;
  complete: boolean;
}

export function AddressGenerationStatus() {
  const [state, setState] = useState<GenerationState>({
    active: false,
    current: 0,
    total: 64,
    complete: true
  });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkInitialState = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          method: 'wallet:getGenerationStatus'
        });
        
        if (response?.result) {
          const { isComplete, addressCount, isActive } = response.result;
          if (!isComplete && addressCount > 0) {
            setState({
              active: isActive,
              current: addressCount,
              total: 64,
              complete: false
            });
            setVisible(true);
          }
        }
      } catch (e) {
        console.log('[AddressGenerationStatus] Could not check initial state');
      }
    };

    checkInitialState();

    const handleMessage = (message: any) => {
      if (message?.method === 'wallet:generationProgress') {
        const { current, total, complete } = message;
        
        if (complete) {
          setState(prev => ({ ...prev, complete: true, active: false }));
          setTimeout(() => setVisible(false), 1500);
        } else {
          setState({
            active: true,
            current,
            total,
            complete: false
          });
          setVisible(true);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '72px',
      left: 0,
      right: 0,
      height: '24px',
      background: 'var(--bg-elevated, #1a1a1a)',
      borderTop: '1px solid var(--border-subtle, #333)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontFamily: 'var(--font-mono, monospace)',
      color: 'var(--text-secondary, #888)',
      opacity: state.complete ? 0 : 1,
      transform: state.complete ? 'translateY(24px)' : 'translateY(0)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      zIndex: 50,
    }}>
      {state.complete ? (
        <span>✓ All addresses ready</span>
      ) : (
        <span>Generating addresses... {state.current}/{state.total}</span>
      )}
    </div>
  );
}

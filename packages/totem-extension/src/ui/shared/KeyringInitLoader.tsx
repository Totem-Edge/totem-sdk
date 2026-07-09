import React, { useEffect, useState, useRef } from "react";
import { isDesignerMode } from "../../config/constants";
import { TotemEagleMark, TotemWordmark } from "../assets";
import { WalletInitEvent, WALLET_INIT_PORT_NAME } from "../../core/wallet/events";

interface KeyringInitLoaderProps {
  onComplete: () => void;
  onError: (error: string) => void;
  password: string;
  baseSeed: number[];
  mnemonic: string;
}

export function KeyringInitLoader({ onComplete, onError, password, baseSeed, mnemonic }: KeyringInitLoaderProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string) => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    let port: chrome.runtime.Port | null = null;
    
    const initBalanceStream = async () => {
      // NOTE: Balance streaming is now handled by useBalanceStream hook in Home page.
      // We only request a snapshot here to warm the cache.
      // The idempotent start() in BalanceStreamManager prevents duplicate subscriptions.
      try {
        const walletStateResponse = await chrome.runtime.sendMessage({
          method: 'wallet:getState'
        });
        
        const accounts = walletStateResponse?.result?.accounts || walletStateResponse?.accounts || [];
        if (accounts.length > 0) {
          const addresses = accounts.map((acc: { address: string }) => acc.address);
          // Only request snapshot to warm cache - don't start a new stream
          // The Home page's useBalanceStream hook will start the stream
          const portfolioPort = chrome.runtime.connect({ name: 'portfolio-stream' });
          portfolioPort.postMessage({ type: 'GET_SNAPSHOT', addresses });
          // Disconnect after snapshot request (stream not needed from here)
          setTimeout(() => {
            try { portfolioPort.disconnect(); } catch (e) {}
          }, 2000);
        }
      } catch (balanceErr) {
        console.warn('[KeyringLoader] Failed to request balance snapshot:', balanceErr);
      }
    };
    
    const executeInitialization = async () => {
      try {
        if (isDesignerMode()) {
          const { walletManager } = await import('../../core/wallet');
          
          await walletManager.importWalletWithEvents(mnemonic, password, (event: WalletInitEvent) => {
            addLog(event.message);
            
            if (event.phase === 'fast_unlock' || event.phase === 'complete') {
              // Wallet is usable after fast_unlock (4 addresses ready)
              // Background generation continues for remaining 60 addresses
              setIsComplete(true);
              // Fire onComplete immediately - don't wait for balance stream
              onComplete();
              // Start balance stream in background (fire and forget)
              initBalanceStream().catch(() => {});
            } else if (event.phase === 'error') {
              setHasError(true);
              onError(event.error || 'Unknown error');
            }
          });
          
          await chrome.storage.local.set({ walletSetup: true });
          
        } else {
          port = chrome.runtime.connect({ name: WALLET_INIT_PORT_NAME });
          
          port.onMessage.addListener((msg) => {
            if (msg.type === 'INIT_EVENT') {
              const event = msg.payload as WalletInitEvent;
              addLog(event.message);
              
              // Also handle fast_unlock phase from events
              if (event.phase === 'fast_unlock') {
                setIsComplete(true);
                // Fire onComplete immediately - don't wait for balance stream
                onComplete();
                // Start balance stream in background (fire and forget)
                initBalanceStream().catch(() => {});
              }
            } else if (msg.type === 'IMPORT_COMPLETE') {
              setIsComplete(true);
              // Fire onComplete immediately - don't wait for balance stream
              onComplete();
              // Start balance stream in background (fire and forget)
              initBalanceStream().catch(() => {});
            } else if (msg.type === 'IMPORT_ERROR') {
              addLog(`ERROR: ${msg.payload.error}`);
              setHasError(true);
              onError(msg.payload.error);
            }
          });
          
          port.onDisconnect.addListener(() => {
            if (!isComplete && !hasError) {
              addLog('Connection lost');
            }
          });
          
          port.postMessage({ 
            type: 'IMPORT_WALLET', 
            mnemonic, 
            password 
          });
        }
        
      } catch (error) {
        console.error('[KeyringLoader] Setup error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        addLog(`ERROR: ${errorMessage}`);
        setHasError(true);
        onError(errorMessage);
      }
    };

    executeInitialization();
    
    return () => {
      if (port) {
        try {
          port.disconnect();
        } catch (e) {
        }
      }
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100dvh',
      maxHeight: '600px',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'var(--space-3)',
      overflow: 'hidden',
      boxSizing: 'border-box' as const,
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--border)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-3)',
          boxShadow: 'var(--shadow-lg)',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-2)',
            position: 'relative'
          }}>
            <TotemEagleMark size={56} color="var(--text-primary)" />
            <div style={{ marginTop: 'var(--space-1)' }}>
              <TotemWordmark width={100} color="var(--text-primary)" />
            </div>
          </div>
          
          <h2 style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--text)',
            textAlign: 'center',
            marginBottom: '0',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            INITIALIZING WALLET
          </h2>
        </div>

        <div style={{
          background: '#000000',
          border: '2px solid var(--accent)',
          padding: 'var(--space-2)',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'monospace',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{
            fontSize: '10px',
            color: 'var(--accent)',
            marginBottom: 'var(--space-1)',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            flexShrink: 0
          }}>
            &gt; SYSTEM LOG
          </div>
          <div 
            ref={logContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden'
            }}
          >
            {logs.map((log, index) => (
              <div key={index} style={{
                fontSize: '10px',
                color: log.includes('ERROR') ? '#EF4444' : 
                       log.includes('complete') || log.includes('Complete') ? 'var(--accent)' :
                       '#00FF00',
                lineHeight: '1.5',
                fontFamily: 'monospace',
                wordBreak: 'break-word'
              }}>
                {log}
              </div>
            ))}
            {!isComplete && !hasError && (
              <div style={{
                fontSize: '10px',
                color: '#00FF00',
                lineHeight: '1.5',
                fontFamily: 'monospace',
                animation: 'blink 1s infinite'
              }}>
                _
              </div>
            )}
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--border)',
          padding: 'var(--space-2)',
          marginTop: 'var(--space-2)',
          boxShadow: 'var(--shadow-sm)',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-1)'
          }}>
            <span style={{ fontSize: '14px' }}>&#128274;</span>
            <div>
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px'
              }}>
                QUANTUM-RESISTANT DERIVATION
              </div>
              <div style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                lineHeight: '1.4'
              }}>
                Each address has its own TreeKey derived via hashObjects(baseSeed, index). WOTS w=8 uses 34 SHA3-256 hash chains.
                Your keys are computed locally and never leave your device - true self-custody.
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import '../theme/axia-tokens.css';

type ScanStatus = 'starting' | 'scanning' | 'found' | 'wrong-qr' | 'error';

export function ScannerApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<ScanStatus>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const msgListener = (msg: any) => {
      if (msg?.type === 'QR_DONE') window.close();
    };
    chrome.runtime.onMessage.addListener(msgListener);
    return () => chrome.runtime.onMessage.removeListener(msgListener);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus('scanning');
        rafRef.current = requestAnimationFrame(scanFrame);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access for this extension in your browser settings.'
          : err?.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : `Camera error: ${err?.message || 'unknown'}`;
        setErrorMsg(msg);
        setStatus('error');
      }
    };

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      const { videoWidth: w, videoHeight: h } = video;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const result = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
      if (result) {
        if (result.data.startsWith('Mx') || result.data.startsWith('mx')) {
          stopCamera();
          setStatus('found');
          chrome.storage.session.set({ pendingQRScan: { address: result.data, ts: Date.now() } });
          return;
        } else {
          setStatus('wrong-qr');
        }
      } else {
        setStatus(s => s === 'wrong-qr' ? 'scanning' : s);
      }
      rafRef.current = requestAnimationFrame(scanFrame);
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const statusLabel: Record<ScanStatus, string> = {
    starting: 'Starting camera...',
    scanning: 'Scanning for Minima address...',
    found: 'Address captured — complete your send in the extension',
    'wrong-qr': 'QR found — not a Minima address. Keep scanning...',
    error: errorMsg,
  };

  const statusColor: Record<ScanStatus, string> = {
    starting: '#8899aa',
    scanning: '#00d9b5',
    found: '#00d9b5',
    'wrong-qr': '#f59e0b',
    error: '#ef4444',
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#0d1117',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-family, ui-monospace, monospace)',
      overflow: 'hidden',
      color: '#e2e8f0',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '2px solid #1e2a38',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        background: '#0d1117',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#e2e8f0' }}>
          Scan QR Code
        </span>
        <button
          onClick={() => window.close()}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8899aa', fontSize: '16px', lineHeight: 1, padding: '4px 8px' }}
        >
          ✕
        </button>
      </div>

      {/* Viewfinder */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: status === 'error' ? 'none' : 'block',
          }}
        />

        {/* Reticle corners */}
        {(status === 'scanning' || status === 'wrong-qr' || status === 'starting') && (
          <div style={{ position: 'absolute', width: '200px', height: '200px', pointerEvents: 'none' }}>
            {[
              { top: 0, left: 0, borderTop: '3px solid #00d9b5', borderLeft: '3px solid #00d9b5' },
              { top: 0, right: 0, borderTop: '3px solid #00d9b5', borderRight: '3px solid #00d9b5' },
              { bottom: 0, left: 0, borderBottom: '3px solid #00d9b5', borderLeft: '3px solid #00d9b5' },
              { bottom: 0, right: 0, borderBottom: '3px solid #00d9b5', borderRight: '3px solid #00d9b5' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', width: '28px', height: '28px', ...s }} />
            ))}
          </div>
        )}

        {/* Found state */}
        {status === 'found' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,217,181,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <span style={{ fontSize: '56px', lineHeight: 1 }}>✓</span>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00d9b5', textAlign: 'center', maxWidth: '240px', lineHeight: 1.5 }}>
              Minima address captured
            </span>
            <span style={{ fontSize: '10px', color: '#8899aa', textAlign: 'center', maxWidth: '240px', lineHeight: 1.5 }}>
              Return to the extension to complete your send
            </span>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{ padding: '24px', textAlign: 'center', maxWidth: '320px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              Camera Unavailable
            </div>
            <div style={{ fontSize: '11px', color: '#8899aa', lineHeight: 1.6 }}>{errorMsg}</div>
            <button onClick={() => window.close()} style={{ marginTop: '20px', padding: '8px 20px', background: 'transparent', border: '2px solid #1e2a38', color: '#e2e8f0', cursor: 'pointer', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Close
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      {status !== 'error' && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #1e2a38', flexShrink: 0, textAlign: 'center', background: '#0d1117' }}>
          <span style={{ fontSize: '10px', color: statusColor[status], letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {statusLabel[status]}
          </span>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

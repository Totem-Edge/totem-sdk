import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Typography, Button } from '../atoms';
import '../../theme/axia-tokens.css';

interface QRScannerModalProps {
  onScan: (address: string) => void;
  onClose: () => void;
}

type ScanStatus = 'starting' | 'scanning' | 'error' | 'wrong-qr';

export function QRScannerModal({ onScan, onClose }: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<ScanStatus>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus('scanning');
        scanFrame();
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : err?.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : `Camera error: ${err?.message || 'unknown error'}`;
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
          onScan(result.data);
          return;
        } else {
          setStatus('wrong-qr');
        }
      } else {
        setStatus('scanning');
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
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const statusLabel: Record<ScanStatus, string> = {
    starting: 'Starting camera...',
    scanning: 'Scanning for Minima address...',
    error: errorMsg,
    'wrong-qr': 'QR found — not a Minima address. Keep scanning...',
  };

  const statusColor: Record<ScanStatus, string> = {
    starting: 'var(--text-muted)',
    scanning: 'var(--axia-aqua)',
    error: 'var(--color-danger)',
    'wrong-qr': 'var(--color-warning, #f59e0b)',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(0,0,0,0.95)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-2)',
        borderBottom: '2px solid var(--border-default)',
        flexShrink: 0,
      }}>
        <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.08em' }}>
          Scan QR Code
        </Typography>
        <Button variant="ghost" size="sm" onClick={handleClose}>✕</Button>
      </div>

      {/* Viewfinder */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
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

        {/* Target reticle overlay */}
        {status !== 'error' && (
          <div style={{
            position: 'absolute',
            width: '200px',
            height: '200px',
            pointerEvents: 'none',
          }}>
            {/* Corner markers */}
            {[
              { top: 0, left: 0, borderTop: '3px solid var(--axia-aqua)', borderLeft: '3px solid var(--axia-aqua)' },
              { top: 0, right: 0, borderTop: '3px solid var(--axia-aqua)', borderRight: '3px solid var(--axia-aqua)' },
              { bottom: 0, left: 0, borderBottom: '3px solid var(--axia-aqua)', borderLeft: '3px solid var(--axia-aqua)' },
              { bottom: 0, right: 0, borderBottom: '3px solid var(--axia-aqua)', borderRight: '3px solid var(--axia-aqua)' },
            ].map((corners, idx) => (
              <div key={idx} style={{
                position: 'absolute',
                width: '24px',
                height: '24px',
                ...corners,
              }} />
            ))}
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div style={{ padding: 'var(--space-3)', textAlign: 'center', maxWidth: '280px' }}>
            <Typography variant="body" bold uppercase style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-2)', display: 'block' }}>
              Camera Unavailable
            </Typography>
            <Typography variant="caption" color="muted" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
              {errorMsg}
            </Typography>
            <Button variant="secondary" size="sm" onClick={handleClose}>Close</Button>
          </div>
        )}
      </div>

      {/* Status bar */}
      {status !== 'error' && (
        <div style={{
          padding: 'var(--space-2)',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
          textAlign: 'center',
        }}>
          <Typography variant="caption" style={{ color: statusColor[status], fontSize: 'var(--text-2xs)', letterSpacing: '0.05em' }}>
            {statusLabel[status]}
          </Typography>
        </div>
      )}

      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

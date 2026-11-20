/**
 * QR scanner for the PWA wallet.
 *
 * The extension opens a dedicated scanner page; a PWA can do the same inline
 * with the browser's BarcodeDetector. When the API is unavailable the dialog
 * explains itself and the user pastes the address instead.
 */

import React, { useEffect, useRef, useState } from 'react';

/** Pull an address out of a QR payload (`0x…`, `Mx…`, or a minima: URI). */
export function extractAddress(raw: string): string {
  const text = (raw || '').trim();
  const hexMatch = text.match(/0x[0-9a-fA-F]{40,}/);
  if (hexMatch) return hexMatch[0];
  const mxMatch = text.match(/Mx[0-9A-Za-z]+/);
  if (mxMatch) return mxMatch[0];
  return text;
}

interface Props {
  onResult: (value: string) => void;
  onClose: () => void;
}

export function QrScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let cancelled = false;

    (async () => {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setError('This browser cannot scan QR codes. Paste the address instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        const detector = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onResult(extractAddress(codes[0].rawValue));
              onClose();
              return;
            }
          } catch {
            /* frame not ready — keep scanning */
          }
          timer = window.setTimeout(tick, 350);
        };
        void tick();
      } catch (e: any) {
        setError(e?.message || 'Camera unavailable.');
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
      }}
    >
      {!error && (
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', maxWidth: 360, border: '2px solid var(--axia-aqua)' }}
        />
      )}
      {error && (
        <p style={{ color: 'var(--color-danger, #ff6b6b)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          {error}
        </p>
      )}
      {!error && (
        <p style={{ color: '#fff', fontSize: 'var(--text-xs)', opacity: 0.8 }}>
          Point the camera at a Minima address QR code
        </p>
      )}
      <button className="btn btn-secondary btn-sm" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}

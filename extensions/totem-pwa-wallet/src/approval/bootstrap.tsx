/**
 * Approval-page bootstrap.
 *
 * Every Vite entry point is its own JS realm. The approval pages are separate
 * from `main.tsx`, so they must initialise the wasm-bindgen core before React
 * renders and before any unlock/key-derivation call runs. Without this the
 * first crypto call throws:
 *   TypeError: Cannot read properties of undefined (reading '__wbindgen_malloc')
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ensureWasm } from '../core/wasm';

export function bootstrapApproval(element: React.ReactElement): void {
  ensureWasm()
    .then(() => {
      ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>{element}</React.StrictMode>,
      );
    })
    .catch((err) => {
      console.error('[approval] WASM init failed', err);
      const root = document.getElementById('root');
      if (root) root.textContent = 'Failed to start Totem Wallet. Please reload.';
    });
}

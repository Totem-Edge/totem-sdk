/**
 * Shared mount for approval pages.
 *
 * Approval windows are separate Vite entries, so they get their own JS realm
 * and their own `@totemsdk/core-wasm` instance. The main app initialises the
 * WASM core in `main.tsx`; every approval entry must do the same before any
 * unlock, derive or signing call, or the first crypto call throws
 *   TypeError: Cannot read properties of undefined (reading '__wbindgen_malloc')
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ensureWasm } from '../core/wasm';

export function mountApproval(node: React.ReactNode): void {
  const root = document.getElementById('root');
  if (!root) {
    console.error('[PWA] approval root missing');
    return;
  }

  root.textContent = 'Starting Totem Wallet…';

  ensureWasm()
    .then(() => {
      ReactDOM.createRoot(root).render(<React.StrictMode>{node}</React.StrictMode>);
    })
    .catch((err) => {
      console.error('[PWA] WASM init failed', err);
      root.textContent = 'Failed to start Totem Wallet. Please reload.';
    });
}

import '../../core/storage/typedStorage'; // runtime chrome.storage.*.getTyped (must run first)
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScannerApp } from './ScannerApp';

const container = document.getElementById('scanner-root');
if (container) {
  createRoot(container).render(<ScannerApp />);
}

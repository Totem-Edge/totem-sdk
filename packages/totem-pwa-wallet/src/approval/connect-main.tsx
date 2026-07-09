import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConnectApproval } from './ConnectApproval';
import '../theme/axia-tokens.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConnectApproval />
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { SendApproval } from './SendApproval';
import '../theme/axia-tokens.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SendApproval />
  </React.StrictMode>
);

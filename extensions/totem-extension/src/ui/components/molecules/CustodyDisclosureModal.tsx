/**
 * RFC-058 — blocking custody disclosure shown before a hosted liquidity
 * commitment is signed. The confirm button stays disabled until the user
 * explicitly acknowledges the disclosure.
 */

import React, { useState } from 'react';
import { Card, Typography, Button } from '../atoms';
import {
  custodyDisclosureWarnings,
  validateCustodyDisclosure,
  type CustodyDisclosure,
} from '../../../core/custody/disclosure';
import '../../theme/axia-tokens.css';

export interface CustodyDisclosureModalProps {
  custody: CustodyDisclosure;
  onAcknowledge: () => void;
  onCancel: () => void;
}

export function CustodyDisclosureModal({ custody, onAcknowledge, onCancel }: CustodyDisclosureModalProps) {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warnings = custodyDisclosureWarnings(custody);

  const confirm = () => {
    try {
      validateCustodyDisclosure(custody);
      if (!checked) return;
      onAcknowledge();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-2)' }}>
      <Typography variant="h2" color="primary" style={{ textAlign: 'center' }}>
        Custody Disclosure
      </Typography>
      <Card padding="lg" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--color-warning)' }}>
        <Typography variant="caption" color="muted" uppercase>Operator</Typography>
        <Typography variant="body" bold>{custody.legalEntity ?? custody.operatorId ?? 'Unknown operator'}</Typography>
        {custody.jurisdiction && (
          <Typography variant="caption" color="muted">Jurisdiction: {custody.jurisdiction}</Typography>
        )}
        {custody.license && (
          <Typography variant="caption" color="muted">Licence: {custody.license}</Typography>
        )}
        {custody.keyManagement && (
          <Typography variant="caption" color="muted">Key management: {custody.keyManagement}</Typography>
        )}
        {custody.policySummary && (
          <Typography variant="caption" color="muted">Policy: {custody.policySummary}</Typography>
        )}
        {custody.disclosureHash && (
          <Typography variant="caption" color="muted" mono>
            Disclosure {custody.disclosureVersion ?? ''}: {custody.disclosureHash.slice(0, 18)}...
          </Typography>
        )}
      </Card>

      <Card padding="sm" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'var(--color-warning)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {warnings.map((warning) => (
            <Typography key={warning} variant="caption" color="warning">{warning}</Typography>
          ))}
        </div>
      </Card>

      {!requires(custody) && (
        <Typography variant="caption" color="muted">Self-custody: no operator disclosure is required.</Typography>
      )}
      {error && <Typography variant="caption" color="warning">{error}</Typography>}

      <label style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'flex-start', fontSize: '0.8rem' }}>
        <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
        <span>I have read and understand the custody disclosure, operator powers and withdrawal terms.</span>
      </label>

      <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
        <Button variant="secondary" size="lg" onClick={onCancel} style={{ flex: 1 }}>Cancel</Button>
        <Button variant="primary" size="lg" onClick={confirm} disabled={!checked || !requires(custody)} style={{ flex: 2 }}>
          Acknowledge and continue
        </Button>
      </div>
    </div>
  );
}

function requires(custody: CustodyDisclosure): boolean {
  return custody.mode === 'hosted' || custody.mode === 'trust-minimised';
}

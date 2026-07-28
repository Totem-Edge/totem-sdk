/**
 * AXIA BURN CARD
 * Optional burn amount selector for transaction prioritization
 * Minima has no fees - burn is voluntary to prioritize transactions
 */

import React, { useState, useEffect } from 'react';
import { Card, Typography, Button } from '../atoms';
import { formatAmount, parseMinimaAmount } from '../../../constants';
import '../../theme/axia-tokens.css';

interface BurnMetrics {
  last1: { min: string; max: string; avg: string; median: string; count: number };
  last10: { min: string; max: string; avg: string; median: string; count: number };
  last50: { min: string; max: string; avg: string; median: string; count: number };
  fetchedAt: string;
}

export interface BurnCardProps {
  burnAmount: string;
  onBurnChange: (amount: string) => void;
  disabled?: boolean;
}

export function BurnCard({ 
  burnAmount, 
  onBurnChange,
  disabled = false
}: BurnCardProps) {
  const [metrics, setMetrics] = useState<BurnMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const apiBaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AXIA_API_BASE_URL) || 'https://api.axia.to';

  useEffect(() => {
    if (expanded) {
      fetchBurnMetrics();
    }
  }, [expanded]);

  const fetchBurnMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/public/minima/burn-stats`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setMetrics(data.data);
      } else {
        setError('Failed to load network data');
      }
    } catch (err: any) {
      console.error('[BurnCard] Failed to fetch burn metrics:', err);
      setError('Network unavailable');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (amount: string) => {
    onBurnChange(amount);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onBurnChange(value);
    }
  };

  const formatBurnDisplay = (baseUnits: string): string => {
    return formatAmount(baseUnits, 4);
  };

  const getNetworkActivity = (): 'low' | 'medium' | 'high' => {
    if (!metrics) return 'low';
    const avgBurn = parseFloat(formatAmount(metrics.last10.avg, 8));
    if (avgBurn > 0.1) return 'high';
    if (avgBurn > 0.01) return 'medium';
    return 'low';
  };

  const activityConfig = {
    low: { color: 'var(--color-success)', label: 'LOW ACTIVITY', description: 'Burn not needed' },
    medium: { color: 'var(--color-warning)', label: 'MODERATE', description: 'Small burn recommended' },
    high: { color: 'var(--color-danger)', label: 'HIGH ACTIVITY', description: 'Burn recommended' }
  };

  const activity = getNetworkActivity();
  const config = activityConfig[activity];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
            Burn (Optional)
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7 }}>
            Priority
          </span>
        </div>
        <span style={{ color: 'var(--axia-aqua)', fontSize: '10px', transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>
          ▾
        </span>
      </div>

      {!expanded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="text"
            value={burnAmount}
            onChange={handleInputChange}
            placeholder="0"
            disabled={disabled}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            MINIMA
          </span>
        </div>
      )}

      {expanded && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '6px',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px',
          background: 'var(--bg-elevated)',
        }}>
          {loading ? (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Loading network data...</span>
          ) : error ? (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>{error}</span>
          ) : metrics && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
                background: 'rgba(0,0,0,0.2)',
                border: `1px solid ${config.color}`,
                borderRadius: '2px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: config.color, display: 'inline-block' }} />
                  <span style={{ fontSize: '10px', fontWeight: 700, color: config.color }}>{config.label}</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{config.description}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Min</div>
                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>{formatBurnDisplay(metrics.last10.min)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Avg</div>
                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--axia-aqua)', fontWeight: 700 }}>{formatBurnDisplay(metrics.last10.avg)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Max</div>
                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>{formatBurnDisplay(metrics.last10.max)}</div>
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '4px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
            <Button variant="secondary" size="sm" onClick={() => handlePresetClick('0')} disabled={disabled} style={{ flex: 1, fontSize: '10px', padding: '3px 4px' }}>None</Button>
            <Button variant="secondary" size="sm" onClick={() => handlePresetClick('0.01')} disabled={disabled} style={{ flex: 1, fontSize: '10px', padding: '3px 4px' }}>0.01</Button>
            <Button variant="secondary" size="sm" onClick={() => handlePresetClick('0.1')} disabled={disabled} style={{ flex: 1, fontSize: '10px', padding: '3px 4px' }}>0.1</Button>
            <Button variant="secondary" size="sm" onClick={() => handlePresetClick(metrics ? formatAmount(metrics.last10.avg, 4) : '0.05')} disabled={disabled || !metrics} style={{ flex: 1, fontSize: '10px', padding: '3px 4px' }}>Avg</Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="text"
              value={burnAmount}
              onChange={handleInputChange}
              placeholder="0"
              disabled={disabled}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>MINIMA</span>
          </div>
        </div>
      )}
    </div>
  );
}

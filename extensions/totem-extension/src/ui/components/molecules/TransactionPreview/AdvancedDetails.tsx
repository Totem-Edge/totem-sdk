/**
 * Advanced Details Component
 * Collapsible section showing inputs, outputs, and raw data
 */

import React, { useState } from 'react';
import { Typography, Card } from '../../atoms';
import { formatAmount } from '../../../../constants';
import type { TransactionInput, TransactionOutput } from './types';

interface AdvancedDetailsProps {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  rawTransaction?: string;
  rawScripts?: { address: string; script: string }[];
}

export function AdvancedDetails({
  inputs,
  outputs,
  rawTransaction,
  rawScripts
}: AdvancedDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'inputs' | 'outputs' | 'raw'>('inputs');

  const truncate = (str: string, len: number = 16) => {
    if (str.length <= len) return str;
    return `${str.slice(0, len / 2)}...${str.slice(-len / 2)}`;
  };

  return (
    <div style={{ marginTop: 'var(--space-2)' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-1-5) var(--space-2)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: 'var(--text-secondary)'
        }}
      >
        <Typography variant="caption" uppercase>
          Advanced Details
        </Typography>
        <span style={{ 
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div style={{
          marginTop: 'var(--space-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)'
          }}>
            {(['inputs', 'outputs', 'raw'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: 'var(--space-1)',
                  background: activeTab === tab ? 'var(--bg-surface)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--axia-aqua)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600
                }}
              >
                {tab} {tab === 'inputs' ? `(${inputs.length})` : tab === 'outputs' ? `(${outputs.length})` : ''}
              </button>
            ))}
          </div>

          <div style={{ 
            padding: 'var(--space-2)',
            background: 'var(--bg-surface)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {activeTab === 'inputs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {inputs.length === 0 ? (
                  <Typography variant="caption" color="muted">No inputs</Typography>
                ) : (
                  inputs.map((input, i) => (
                    <div 
                      key={i}
                      style={{
                        padding: 'var(--space-1)',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-xs)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Coin:</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{truncate(input.coinId)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Address:</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{truncate(input.address)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Amount:</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{formatAmount(input.amount, 8)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Type:</span>
                        <span style={{ color: 'var(--axia-aqua)' }}>{input.scriptType}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'outputs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {outputs.length === 0 ? (
                  <Typography variant="caption" color="muted">No outputs</Typography>
                ) : (
                  outputs.map((output, i) => (
                    <div 
                      key={i}
                      style={{
                        padding: 'var(--space-1)',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-xs)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Address:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-0-5)' }}>
                          {output.isChange && (
                            <span style={{
                              fontSize: '10px',
                              padding: '1px 4px',
                              background: 'rgba(34, 197, 94, 0.1)',
                              color: 'var(--color-success)',
                              borderRadius: '2px'
                            }}>
                              CHANGE
                            </span>
                          )}
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{truncate(output.address)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Amount:</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{formatAmount(output.amount, 8)}</span>
                      </div>
                      {output.stateVariables && output.stateVariables.length > 0 && (
                        <div style={{ marginTop: 'var(--space-0-5)', paddingTop: 'var(--space-0-5)', borderTop: '1px dashed var(--border-subtle)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>State Variables:</span>
                          {output.stateVariables.map((sv, j) => (
                            <div key={j} style={{ marginLeft: 'var(--space-1)', color: 'var(--axia-aqua)' }}>
                              [{sv.port}]: {truncate(sv.value, 20)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'raw' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {rawScripts && rawScripts.length > 0 && (
                  <div>
                    <Typography variant="caption" color="muted" uppercase style={{ marginBottom: 'var(--space-0-5)' }}>
                      Scripts
                    </Typography>
                    {rawScripts.map((s, i) => (
                      <div 
                        key={i}
                        style={{
                          padding: 'var(--space-1)',
                          background: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: 'var(--space-0-5)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          wordBreak: 'break-all'
                        }}
                      >
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                          {truncate(s.address, 20)}
                        </div>
                        <div style={{ color: 'var(--axia-aqua)' }}>
                          {s.script}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {rawTransaction && (
                  <div>
                    <Typography variant="caption" color="muted" uppercase style={{ marginBottom: 'var(--space-0-5)' }}>
                      Raw Transaction (Hex)
                    </Typography>
                    <div style={{
                      padding: 'var(--space-1)',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      wordBreak: 'break-all',
                      maxHeight: '100px',
                      overflowY: 'auto'
                    }}>
                      {rawTransaction}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

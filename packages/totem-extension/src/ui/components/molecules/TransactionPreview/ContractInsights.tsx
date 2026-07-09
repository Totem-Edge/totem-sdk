/**
 * Contract Insights Component
 * Shows human-readable explanations of what the transaction does
 */

import React from 'react';
import { Typography, Card } from '../../atoms';
import { getRiskBadgeStyle, getRiskIcon } from './RiskClassifier';
import type { ContractInsight, RiskFlag } from './types';

interface ContractInsightsProps {
  insights: ContractInsight[];
  risks: RiskFlag[];
  narrative: string;
}

export function ContractInsights({
  insights,
  risks,
  narrative
}: ContractInsightsProps) {
  if (insights.length === 0 && risks.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <Card padding="md" style={{ 
        background: 'rgba(0, 217, 181, 0.05)',
        borderColor: 'var(--axia-aqua)'
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 'var(--text-lg)' }}>📋</span>
          <div>
            <Typography variant="caption" color="accent" bold uppercase>
              What This Transaction Does
            </Typography>
            <Typography variant="body" style={{ marginTop: 'var(--space-0-5)' }}>
              {narrative}
            </Typography>
          </div>
        </div>
      </Card>

      {insights.map((insight, index) => (
        <Card 
          key={index} 
          padding="md" 
          style={{ background: 'var(--bg-surface)' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body" bold>
                {insight.title}
              </Typography>
              <span style={{
                fontSize: 'var(--text-xs)',
                padding: '2px 8px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase'
              }}>
                {insight.type}
              </span>
            </div>
            
            <Typography variant="caption" color="muted">
              {insight.description}
            </Typography>

            {insight.details && insight.details.length > 0 && (
              <div style={{ 
                marginTop: 'var(--space-1)',
                padding: 'var(--space-1)',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)'
              }}>
                {insight.details.map((detail, i) => (
                  <div 
                    key={i}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      padding: '4px 0'
                    }}
                  >
                    <Typography variant="caption" color="muted">
                      {detail.label}
                    </Typography>
                    <Typography variant="caption" mono>
                      {detail.value}
                    </Typography>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      ))}

      {risks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {risks.map((risk, index) => (
            <div 
              key={index}
              style={{
                display: 'flex',
                gap: 'var(--space-1)',
                padding: 'var(--space-1-5)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                ...getRiskBadgeStyle(risk.severity)
              }}
            >
              <span>{risk.icon || getRiskIcon(risk.severity)}</span>
              <div>
                <Typography 
                  variant="caption" 
                  bold 
                  style={{ color: 'inherit' }}
                >
                  {risk.title}
                </Typography>
                <Typography 
                  variant="caption" 
                  style={{ 
                    color: 'inherit', 
                    opacity: 0.8,
                    marginTop: '2px' 
                  }}
                >
                  {risk.description}
                </Typography>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

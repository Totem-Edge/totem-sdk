/**
 * QUOTA METER - BRUTALIST DESIGN
 * Progress bar showing RPC quota usage with UPPERCASE labels
 */

import React from 'react';
import { Typography } from '../atoms';
import '../../theme/axia-tokens.css';

export interface QuotaMeterProps {
  label: string;
  used: number;
  limit: number;
  resetTime?: number; // Unix timestamp
  size?: 'sm' | 'md' | 'lg';
}

export function QuotaMeter({ 
  label, 
  used, 
  limit, 
  resetTime,
  size = 'md' 
}: QuotaMeterProps) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const remaining = Math.max(limit - used, 0);
  
  // Status color based on usage
  const getStatusColor = (): string => {
    if (percentage >= 90) return 'var(--status-failed)'; // Red - critical
    if (percentage >= 75) return 'var(--status-warning)'; // Yellow - warning
    return 'var(--axia-aqua)'; // Orange - healthy
  };

  // Format reset time as countdown
  const formatResetTime = (): string | null => {
    if (!resetTime) return null;
    
    const now = Date.now();
    const diff = resetTime * 1000 - now; // Convert to ms
    
    if (diff <= 0) return 'Resetting now...';
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 0) {
      return `Resets in ${hours}h ${minutes}m`;
    }
    return `Resets in ${minutes}m`;
  };

  const barHeight = size === 'sm' ? '8px' : size === 'lg' ? '16px' : '12px';
  const statusColor = getStatusColor();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1)',
    }}>
      {/* Header: Label + Stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <Typography variant="caption" uppercase bold>
          {label}
        </Typography>
        <Typography variant="caption" mono>
          {remaining.toLocaleString()} / {limit.toLocaleString()}
        </Typography>
      </div>

      {/* Progress Bar Container */}
      <div style={{
        width: '100%',
        height: barHeight,
        background: 'var(--bg-base)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Fill Bar */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${percentage}%`,
          background: statusColor,
          transition: 'width var(--transition-normal), background-color var(--transition-normal)',
          boxShadow: percentage > 0 ? 'var(--shadow-sm)' : 'none',
        }} />
      </div>

      {/* Footer: Percentage + Reset Time */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <Typography 
          variant="caption" 
          color={percentage >= 90 ? 'danger' : percentage >= 75 ? 'muted' : 'accent'}
          bold
        >
          {percentage.toFixed(1)}% USED
        </Typography>
        {resetTime && (
          <Typography variant="caption" color="muted">
            {formatResetTime()}
          </Typography>
        )}
      </div>
    </div>
  );
}

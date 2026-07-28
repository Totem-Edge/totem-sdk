/**
 * TOTEM THEME SWITCHER
 * Visual theme selector with color swatches
 */

import React from 'react';
import { type ThemeId, themeList } from '../../theme/ThemeRegistry';
import { Typography } from '../atoms';

interface ThemeSwitcherProps {
  currentTheme: ThemeId;
  onThemeChange: (themeId: ThemeId) => void;
}

export function ThemeSwitcher({ currentTheme, onThemeChange }: ThemeSwitcherProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 'var(--space-1)',
    }}>
      {themeList.map((theme) => {
        const isActive = currentTheme === theme.id;
        return (
          <button
            key={theme.id}
            onClick={() => onThemeChange(theme.id)}
            style={{
              padding: 'var(--space-1)',
              background: isActive ? theme.colors.accentMuted : 'var(--bg-base)',
              border: `2px solid ${isActive ? theme.colors.accent : 'var(--border-default)'}`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                background: theme.colors.accent,
                border: `2px solid ${theme.colors.borderDefault}`,
                flexShrink: 0,
              }} />
              <div style={{
                width: '12px',
                height: '12px',
                background: theme.colors.bgElevated,
                border: `1px solid ${theme.colors.borderSubtle}`,
                flexShrink: 0,
              }} />
            </div>
            
            <div style={{ textAlign: 'left' }}>
              <Typography 
                variant="body" 
                bold 
                uppercase 
                style={{ 
                  fontSize: '11px',
                  color: isActive ? theme.colors.accent : 'var(--text-primary)',
                }}
              >
                {theme.name}
              </Typography>
              <Typography 
                variant="caption" 
                style={{ 
                  opacity: 0.7,
                  fontSize: '9px',
                  display: 'block',
                }}
              >
                {theme.description}
              </Typography>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeSwitcher;

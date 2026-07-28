/**
 * TOTEM THEME REGISTRY
 * 6 Switchable color palettes for personalization
 * "aqua" is the default theme; "mono" (black & white) is available as an option
 */

export type ThemeId = 'mono' | 'aqua' | 'midnight' | 'ember' | 'electric' | 'forest';

export interface ThemePalette {
  id: ThemeId;
  name: string;
  description: string;
  colors: {
    accent: string;
    accentMuted: string;
    bgBase: string;
    bgElevated: string;
    bgOverlay: string;
    bgSubtle: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    borderDefault: string;
    borderSubtle: string;
    borderAccent: string;
  };
}

export const DEFAULT_THEME: ThemeId = 'aqua';

export const themes: Record<ThemeId, ThemePalette> = {
  mono: {
    id: 'mono',
    name: 'Mono',
    description: 'Pure black & white',
    colors: {
      accent: '#FFFFFF',
      accentMuted: 'rgba(255, 255, 255, 0.15)',
      bgBase: '#000000',
      bgElevated: '#0A0A0A',
      bgOverlay: '#0A0A0A',
      bgSubtle: '#1A1A1A',
      textPrimary: '#FFFFFF',
      textSecondary: '#CCCCCC',
      textMuted: '#888888',
      borderDefault: '#333333',
      borderSubtle: '#1A1A1A',
      borderAccent: '#FFFFFF',
    },
  },

  aqua: {
    id: 'aqua',
    name: 'Aqua',
    description: 'Classic aqua on slate',
    colors: {
      accent: '#00D9B5',
      accentMuted: 'rgba(0, 217, 181, 0.2)',
      bgBase: '#0f172a',
      bgElevated: '#1e293b',
      bgOverlay: '#1e293b',
      bgSubtle: '#334155',
      textPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      borderDefault: '#475569',
      borderSubtle: '#334155',
      borderAccent: '#00D9B5',
    },
  },

  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep indigo tones',
    colors: {
      accent: '#818CF8',
      accentMuted: 'rgba(129, 140, 248, 0.2)',
      bgBase: '#0C0A1D',
      bgElevated: '#1A1730',
      bgOverlay: '#1A1730',
      bgSubtle: '#2D2A45',
      textPrimary: '#F0EFFF',
      textSecondary: '#C4C1E0',
      textMuted: '#8B87B0',
      borderDefault: '#4B4770',
      borderSubtle: '#2D2A45',
      borderAccent: '#818CF8',
    },
  },

  ember: {
    id: 'ember',
    name: 'Ember',
    description: 'Warm amber glow',
    colors: {
      accent: '#F59E0B',
      accentMuted: 'rgba(245, 158, 11, 0.2)',
      bgBase: '#1A1207',
      bgElevated: '#2D2010',
      bgOverlay: '#2D2010',
      bgSubtle: '#453318',
      textPrimary: '#FFF8E7',
      textSecondary: '#E8D5B5',
      textMuted: '#A89070',
      borderDefault: '#6B5530',
      borderSubtle: '#453318',
      borderAccent: '#F59E0B',
    },
  },

  electric: {
    id: 'electric',
    name: 'Electric',
    description: 'Neon magenta pulse',
    colors: {
      accent: '#EC4899',
      accentMuted: 'rgba(236, 72, 153, 0.2)',
      bgBase: '#0D0D12',
      bgElevated: '#1A1A24',
      bgOverlay: '#1A1A24',
      bgSubtle: '#2A2A38',
      textPrimary: '#FAFAFF',
      textSecondary: '#C8C8D4',
      textMuted: '#8888A0',
      borderDefault: '#4A4A60',
      borderSubtle: '#2A2A38',
      borderAccent: '#EC4899',
    },
  },

  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Natural green tones',
    colors: {
      accent: '#22C55E',
      accentMuted: 'rgba(34, 197, 94, 0.2)',
      bgBase: '#0A1410',
      bgElevated: '#132018',
      bgOverlay: '#132018',
      bgSubtle: '#1F3025',
      textPrimary: '#F0FFF4',
      textSecondary: '#C6E8D0',
      textMuted: '#7FB890',
      borderDefault: '#3D5A45',
      borderSubtle: '#1F3025',
      borderAccent: '#22C55E',
    },
  },
};

export const themeList = Object.values(themes);

export function applyTheme(themeId: ThemeId): void {
  const theme = themes[themeId];
  if (!theme) return;

  const root = document.documentElement;
  const { colors } = theme;

  root.style.setProperty('--axia-aqua', colors.accent);
  root.style.setProperty('--bg-base', colors.bgBase);
  root.style.setProperty('--bg-elevated', colors.bgElevated);
  root.style.setProperty('--bg-overlay', colors.bgOverlay);
  root.style.setProperty('--bg-subtle', colors.bgSubtle);
  root.style.setProperty('--text-primary', colors.textPrimary);
  root.style.setProperty('--text-secondary', colors.textSecondary);
  root.style.setProperty('--text-muted', colors.textMuted);
  root.style.setProperty('--border-default', colors.borderDefault);
  root.style.setProperty('--border-subtle', colors.borderSubtle);
  root.style.setProperty('--border-accent', colors.borderAccent);
  root.style.setProperty('--accent', colors.accent);

  document.body.style.background = colors.bgBase;
}

export const THEME_STORAGE_KEY = 'totem_theme';

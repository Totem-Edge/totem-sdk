/**
 * POPUP THEME BOOTSTRAP
 * Shared utility for all confirmation popups to load and apply the user's theme.
 * Call this at the top of each popup's entry point.
 */

import { type ThemeId, themes, applyTheme, THEME_STORAGE_KEY, DEFAULT_THEME } from './ThemeRegistry';

export async function bootstrapPopupTheme(): Promise<ThemeId> {
  let themeId: ThemeId = DEFAULT_THEME;

  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      const result = await chrome.storage.local.get(THEME_STORAGE_KEY);
      const savedTheme = result[THEME_STORAGE_KEY] as ThemeId;
      if (savedTheme && themes[savedTheme]) {
        themeId = savedTheme;
      }
    } else if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
      if (saved && themes[saved]) {
        themeId = saved;
      }
    }
  } catch (error) {
    console.error('[popupThemeBootstrap] Failed to load theme:', error);
  }

  applyTheme(themeId);
  return themeId;
}

export function getThemeColors(themeId: ThemeId = DEFAULT_THEME) {
  return themes[themeId]?.colors ?? themes[DEFAULT_THEME].colors;
}

export { type ThemeId, themes, applyTheme, DEFAULT_THEME };

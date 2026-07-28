/**
 * TOTEM THEME HOOK
 * React hook for theme state management with persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { type ThemeId, themes, applyTheme, THEME_STORAGE_KEY, DEFAULT_THEME } from './ThemeRegistry';

export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTheme() {
      try {
        if (chrome?.storage?.local) {
          const result = await chrome.storage.local.get(THEME_STORAGE_KEY);
          const savedTheme = result[THEME_STORAGE_KEY] as ThemeId;
          if (savedTheme && themes[savedTheme]) {
            setCurrentTheme(savedTheme);
            applyTheme(savedTheme);
          } else {
            setCurrentTheme(DEFAULT_THEME);
            applyTheme(DEFAULT_THEME);
          }
        } else {
          const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
          if (saved && themes[saved]) {
            setCurrentTheme(saved);
            applyTheme(saved);
          } else {
            setCurrentTheme(DEFAULT_THEME);
            applyTheme(DEFAULT_THEME);
          }
        }
      } catch (error) {
        console.error('[useTheme] Failed to load theme:', error);
        applyTheme(DEFAULT_THEME);
      } finally {
        setIsLoading(false);
      }
    }

    loadTheme();
  }, []);

  const setTheme = useCallback(async (themeId: ThemeId) => {
    if (!themes[themeId]) return;

    setCurrentTheme(themeId);
    applyTheme(themeId);

    try {
      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ [THEME_STORAGE_KEY]: themeId });
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, themeId);
      }
    } catch (error) {
      console.error('[useTheme] Failed to save theme:', error);
    }
  }, []);

  return {
    currentTheme,
    setTheme,
    themes,
    isLoading,
  };
}

export default useTheme;

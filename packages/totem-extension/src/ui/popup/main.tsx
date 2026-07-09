import React from "react";
import { createRoot } from "react-dom/client";
import { BrutalistApp } from "./BrutalistApp";
import { DebugLogProvider } from "../contexts/DebugLogContext";
import { isDesignerMode } from "../../config/constants";
import { applyTheme, DEFAULT_THEME, THEME_STORAGE_KEY, themes, ThemeId } from "../theme/ThemeRegistry";

// Import the Axia Brutalist Design System tokens
import "../theme/axia-tokens.css";

// CRITICAL: Apply theme synchronously BEFORE React renders to prevent color flash
// This ensures the mono (black & white) default theme is visible immediately
function applyThemeImmediately() {
  try {
    // First, apply default theme immediately to prevent flash of wrong colors
    applyTheme(DEFAULT_THEME);
    
    // Then try to load saved theme from storage (async, will override if different)
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.get(THEME_STORAGE_KEY).then((result) => {
        const savedTheme = result[THEME_STORAGE_KEY] as ThemeId;
        if (savedTheme && themes[savedTheme]) {
          applyTheme(savedTheme);
        } else {
          // No saved theme - persist the default
          chrome.storage.local.set({ [THEME_STORAGE_KEY]: DEFAULT_THEME });
        }
      }).catch((err) => {
        console.warn('[Totem Theme] Failed to load saved theme:', err);
      });
    } else {
      // Fallback for dev/non-extension context
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
      if (saved && themes[saved]) {
        applyTheme(saved);
      }
    }
  } catch (error) {
    console.error('[Totem Theme] Failed to apply initial theme:', error);
  }
}

// Apply theme immediately on script load (before React)
applyThemeImmediately();

console.log('[Totem Brutalist] Initializing React app...');

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp();
  });
} else {
  initApp();
}

function initApp() {
  try {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      console.error('[Totem Brutalist] Root element not found!');
      return;
    }
    console.log('[Totem Brutalist] Root element found, rendering app...');
    const root = createRoot(rootElement);
    
    // Wrap with DebugLogProvider in Designer mode only
    const app = isDesignerMode() ? (
      <DebugLogProvider>
        <BrutalistApp />
      </DebugLogProvider>
    ) : (
      <BrutalistApp />
    );
    
    root.render(app);
    console.log('[Totem Brutalist] Brutalist app rendered successfully ✓');
    
    if (isDesignerMode()) {
      console.log('[Totem Brutalist] 🔧 Debug mode active - console will be captured');
    }
  } catch (error) {
    console.error('[Totem Brutalist] Error initializing React app:', error);
  }
}
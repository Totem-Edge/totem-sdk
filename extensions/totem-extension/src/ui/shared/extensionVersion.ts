/**
 * Read the live extension manifest version.
 *
 * UI surfaces previously hard-coded `v1.0.0`, which made Settings and the
 * splash screen disagree with the actual installed build (and with Chrome's
 * extension manager). Always read the manifest at runtime.
 */
export function getExtensionVersion(fallback = "dev"): string {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
      return chrome.runtime.getManifest().version || fallback;
    }
  } catch {
    // Non-extension context (tests / preview).
  }
  return fallback;
}

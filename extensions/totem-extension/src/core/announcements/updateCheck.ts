import type { Announcement } from './store';

/**
 * Extension update awareness.
 *
 * Chrome extensions cannot replace their own running code. This module only
 * detects a newer published build and injects a notice into the existing Axia
 * announcement banner. Chrome applies an update on the next extension reload /
 * browser restart when the extension is installed from the Chrome Web Store or
 * from a CRX served with an update_url. Unpacked extensions must be reloaded
 * manually.
 */

export const UPDATE_ANNOUNCEMENT_ID = -1001;
export const EXTENSION_UPDATE_STORAGE_KEY = 'totem_extension_update';
export const UPDATE_CHECK_INTERVAL_MINUTES = 360;

const RELEASE_API =
  'https://api.github.com/repos/Totem-Edge/totem-sdk/releases/tags/extension-latest';
const DOWNLOAD_URL =
  'https://github.com/Totem-Edge/totem-sdk/releases/download/extension-latest/totem-extension.zip';

interface ExtensionUpdateState {
  latestVersion: string;
  checkedAt: number;
  downloadUrl: string;
  /** Version this result was computed for; a new build must re-check at once. */
  currentVersion?: string;
}

function parseVersion(value: string): number[] {
  return String(value)
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] || 0;
    const right = b[i] || 0;
    if (left !== right) return left > right;
  }
  return false;
}

/**
 * Newest published version from the rolling release's assets.
 *
 * The release workflow attaches both a fixed-name `totem-extension.zip` and a
 * version-stamped `totem-extension-v<version>.zip` (older builds used a bare
 * `totem-extension-<version>.zip`). Both spellings must be accepted: comparing
 * against only the unversioned spelling made every build after 1.0.27 look
 * older than it was, so the update notice never fired.
 */
const VERSIONED_ASSET_NAME = /^totem-extension-v?(\d+\.\d+\.\d+)\.zip$/;

export function latestFromAssets(assets: unknown): string | null {
  if (!Array.isArray(assets)) return null;
  const versions = assets
    .map((asset) => {
      const name = typeof asset?.name === 'string' ? asset.name : '';
      return VERSIONED_ASSET_NAME.exec(name)?.[1] || null;
    })
    .filter((value): value is string => Boolean(value));
  versions.sort((a, b) => (isNewerVersion(a, b) ? -1 : isNewerVersion(b, a) ? 1 : 0));
  return versions[0] || null;
}

async function readUpdateState(): Promise<ExtensionUpdateState | null> {
  try {
    const result = await chrome.storage.local.getTyped(EXTENSION_UPDATE_STORAGE_KEY);
    const state = result[EXTENSION_UPDATE_STORAGE_KEY] as ExtensionUpdateState | undefined;
    return state && state.latestVersion ? state : null;
  } catch {
    return null;
  }
}

export async function checkForExtensionUpdate(force = false): Promise<ExtensionUpdateState | null> {
  const currentVersion = chrome.runtime.getManifest().version;
  const cached = await readUpdateState();
  const cacheApplies =
    cached &&
    cached.currentVersion === currentVersion &&
    Date.now() - cached.checkedAt < UPDATE_CHECK_INTERVAL_MINUTES * 60_000;
  if (!force && cacheApplies) {
    return cached;
  }
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (!response.ok) return cached;
    const payload = await response.json();
    const latestVersion = latestFromAssets(payload?.assets);
    if (!latestVersion) return cached;
    const state: ExtensionUpdateState = {
      latestVersion,
      checkedAt: Date.now(),
      downloadUrl: DOWNLOAD_URL,
      currentVersion,
    };
    await chrome.storage.local.set({ [EXTENSION_UPDATE_STORAGE_KEY]: state });
    return state;
  } catch {
    return cached;
  }
}

export async function getUpdateAnnouncement(): Promise<Announcement | null> {
  const state = await readUpdateState();
  if (!state) return null;
  const currentVersion = chrome.runtime.getManifest().version;
  if (!isNewerVersion(state.latestVersion, currentVersion)) return null;
  return {
    id: UPDATE_ANNOUNCEMENT_ID,
    title: 'Extension update available',
    description:
      `You are on v${currentVersion}; v${state.latestVersion} is available. ` +
      'Chrome cannot replace extension code while it is running. Download the ' +
      'new build, then reload the extension (or restart Chrome).',
    image_url: null,
    link_url: state.downloadUrl,
    priority: 1000,
    status: 'active',
    updated_at: `v${state.latestVersion}`,
  };
}

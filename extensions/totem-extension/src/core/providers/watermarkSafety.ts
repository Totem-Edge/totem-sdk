/**
 * WOTS watermark migration safety for Hawk mode (RFC-013 / RFC-062 Amendment A).
 *
 * Local signing is only safe when the local watermark is at least as advanced
 * as every index this wallet has ever used. Axia-issued indices are mirrored
 * into the local watermark on prepare; the unlock path also syncs the local
 * watermark from Axia. This module records those outcomes so a Hawk send can
 * fail closed when the authoritative position is unknown.
 *
 * Residual risk: a wallet that used Axia before the mirror existed has no
 * Axia-usage record. Such a wallet should unlock once with Axia reachable (or
 * restore a watermark seed) before switching to Hawk mode.
 */

const SYNC_STATE_KEY = 'totem_watermark_sync_state';
const EVER_USED_AXIA_KEY = 'totem_ever_used_axia';

export interface WatermarkSyncState {
  lastSyncSuccessAt?: number;
  lastSyncFailureAt?: number;
  lastSyncFailureReason?: string;
  lastMirrorSuccessAt?: number;
  lastMirrorFailureAt?: number;
  lastMirrorFailureReason?: string;
}

function storageGet(keys: string | string[]): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    try {
      const result: any = (chrome.storage.local as any).get(keys, (value: any) =>
        resolve(value ?? {}),
      );
      if (result && typeof result.then === 'function') {
        result.then((value: any) => resolve(value ?? {}));
      }
    } catch {
      resolve({});
    }
  });
}

function storageSet(values: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    try {
      const result: any = (chrome.storage.local as any).set(values, () => resolve());
      if (result && typeof result.catch === 'function') {
        result.catch(() => resolve());
      }
    } catch {
      resolve();
    }
  });
}

export async function readWatermarkSafetyState(): Promise<{
  state: WatermarkSyncState;
  everUsedAxia: boolean;
}> {
  const stored = await storageGet([SYNC_STATE_KEY, EVER_USED_AXIA_KEY]);
  return {
    state: (stored[SYNC_STATE_KEY] as WatermarkSyncState) ?? {},
    everUsedAxia: stored[EVER_USED_AXIA_KEY] === true,
  };
}

async function updateState(patch: Partial<WatermarkSyncState>): Promise<void> {
  const { state } = await readWatermarkSafetyState();
  await storageSet({ [SYNC_STATE_KEY]: { ...state, ...patch } });
}

/** Record the outcome of the unlock-time Axia watermark sync. */
export async function recordWatermarkSync(ok: boolean, reason?: string): Promise<void> {
  const now = Date.now();
  if (ok) {
    await updateState({
      lastSyncSuccessAt: now,
      lastSyncFailureReason: undefined,
    });
  } else {
    await updateState({
      lastSyncFailureAt: now,
      ...(reason ? { lastSyncFailureReason: reason } : {}),
    });
  }
}

/** Mark that this wallet has used Axia for signing at least once. */
export async function recordAxiaLease(): Promise<void> {
  await storageSet({ [EVER_USED_AXIA_KEY]: true });
}

/** Record whether the Axia-issued indices were mirrored into the local watermark. */
export async function recordWatermarkMirror(ok: boolean, reason?: string): Promise<void> {
  const now = Date.now();
  if (ok) {
    await updateState({
      lastMirrorSuccessAt: now,
      lastMirrorFailureReason: undefined,
    });
  } else {
    await updateState({
      lastMirrorFailureAt: now,
      ...(reason ? { lastMirrorFailureReason: reason } : {}),
    });
  }
}

/**
 * Throw when a Hawk send cannot prove the local watermark is at least as
 * advanced as the last Axia-issued index.
 *
 * Safe cases:
 *  - this wallet has never used Axia;
 *  - the most recent Axia lease was mirrored into the local watermark;
 *  - a full Axia watermark sync succeeded after the last mirror failure.
 *
 * A fresh Hawk-only wallet is always safe (its local watermark is the authority).
 */
export async function assertHawkWatermarkSafe(): Promise<void> {
  const { state, everUsedAxia } = await readWatermarkSafetyState();

  if (!everUsedAxia) return;

  const lastSyncOk = state.lastSyncSuccessAt ?? 0;
  const lastSyncFail = state.lastSyncFailureAt ?? 0;
  const lastMirrorOk = state.lastMirrorSuccessAt ?? 0;
  const lastMirrorFail = state.lastMirrorFailureAt ?? 0;

  const mirrorOkCoversFailure = lastMirrorOk >= lastMirrorFail;
  const syncOkCoversFailure = lastSyncOk >= lastSyncFail;

  if (!mirrorOkCoversFailure && lastSyncOk < lastMirrorFail) {
    throw new Error(
      'Local signing is paused: the WOTS watermark was not updated after the last Axia lease. ' +
        'Unlock once with Axia reachable to sync the watermark, then retry.',
    );
  }

  if (!syncOkCoversFailure && lastMirrorOk < lastSyncFail) {
    throw new Error(
      'Local signing is paused: the last WOTS watermark sync failed. ' +
        'Unlock once with Axia reachable (or restore a watermark seed) before using the local node.',
    );
  }
}

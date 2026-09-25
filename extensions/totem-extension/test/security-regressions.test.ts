/**
 * Security regression tests for AUD-007, AUD-002 and AUD-008.
 *
 * These read the source as text (same pattern as provider-api.test.ts) so they
 * run even when the background module cannot be type-checked in isolation.
 */

import * as fs from 'fs';
import * as path from 'path';

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');
}

const bg = readSrc('src/background/index.ts');
const wm = readSrc('src/core/stores/WatermarkStore.ts');
const verifyUi = readSrc('src/ui/verify/main.tsx');

// ─── AUD-007: dispatcher normalizes origin from sender.tab.url ────────────────

describe('AUD-007 — DApp origin is derived from sender.tab.url in the dispatcher', () => {
  test('handleMessage re-binds params instead of destructuring const', () => {
    expect(bg).toContain('let params = request.params;');
  });

  test('dispatcher overwrites params.origin with a browser-verified trusted origin', () => {
    expect(bg).toContain('new URL(sender.tab.url).origin');
    expect(bg).toMatch(/params\s*=\s*\{\s*\.\.\.\(params && typeof params === 'object'/);
    expect(bg).toContain('origin: trustedOrigin');
  });

  test('dispatcher rejects DApp callers when origin cannot be determined', () => {
    expect(bg).toContain("return { ok: false, error: 'Cannot determine caller origin', id };");
  });

  test('origin normalization happens inside the DApp-sender branch', () => {
    const dappBranch = bg.indexOf('if (isDAppSender(sender)) {');
    const overwrite = bg.indexOf('params = { ...(params && typeof params ===');
    expect(dappBranch).toBeGreaterThan(-1);
    expect(overwrite).toBeGreaterThan(dappBranch);
  });

  test('every DApp-allowed method is covered by the single dispatcher normalization', () => {
    // No handler should fall back to trusting a caller-supplied origin for a
    // DApp-reachable method: params.origin is overwritten before the switch.
    const switchIdx = bg.indexOf('switch (messageType) {');
    const overwrite = bg.indexOf('params = { ...(params && typeof params ===');
    expect(overwrite).toBeLessThan(switchIdx);
  });
});

// ─── AUD-002: atomic reservation + single in-flight queue ─────────────────────

describe('AUD-002 — WatermarkStore reserves atomically', () => {
  test('exposes reserveNextIndicesForAddress and releaseReservation', () => {
    expect(wm).toContain('async reserveNextIndicesForAddress(');
    expect(wm).toContain('async releaseReservation(');
  });

  test('reserve advances next_l1/next_l2 before returning the slot', () => {
    const reserveBody = wm.slice(
      wm.indexOf('async reserveNextIndicesForAddress('),
      wm.indexOf('async releaseReservation(')
    );
    expect(reserveBody).toContain('addrWm.next_l1 = next.l1;');
    expect(reserveBody).toContain('addrWm.next_l2 = next.l2;');
    expect(reserveBody).toContain('await this.save(this.state);');
  });

  test('release keeps the slot reusable without decrementing the watermark', () => {
    const start = wm.indexOf('async releaseReservation(');
    const end = wm.indexOf('async advanceWatermark(', start);
    const releaseBody = wm.slice(start, end);
    expect(releaseBody).toContain('releasedIndices');
    expect(releaseBody).not.toContain('next_l1 =');
  });
});

describe('AUD-002 — background serializes and uses the reserved slot', () => {
  test('a single in-flight signing lock exists', () => {
    expect(bg).toContain('function withSigningLock');
    expect(bg).toContain('withSigningLock(() =>');
  });

  test('TOTEM_VERIFY reserves before showing the popup', () => {
    const verifyCase = bg.indexOf("case 'TOTEM_VERIFY'");
    const reserve = bg.indexOf('reserveNextIndicesForAddress(addressIndex)', verifyCase);
    const popup = bg.indexOf('showVerifyApprovalPopup(', verifyCase);
    expect(verifyCase).toBeGreaterThan(-1);
    expect(reserve).toBeGreaterThan(verifyCase);
    expect(popup).toBeGreaterThan(reserve);
  });

  test('TOTEM_VERIFY releases the reservation on reject and expiry', () => {
    const verifyCase = bg.indexOf("case 'TOTEM_VERIFY'");
    const nextCase = bg.indexOf("case 'TOTEM_SEND_TRANSACTION'");
    const verifyBody = bg.slice(verifyCase, nextCase);
    expect(verifyBody).toContain('releaseReservation(reserved)');
    expect((verifyBody.match(/releaseReservation\(reserved\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  test('TOTEM_VERIFY marks the reserved slot used instead of advancing again', () => {
    const verifyCase = bg.indexOf("case 'TOTEM_VERIFY'");
    const nextCase = bg.indexOf("case 'TOTEM_SEND_TRANSACTION'");
    const verifyBody = bg.slice(verifyCase, nextCase);
    expect(verifyBody).toContain('markUsed(reserved)');
    expect(verifyBody).not.toContain('advanceWatermark');
  });

  test('no handler advances the watermark after a non-reserving read anymore', () => {
    expect(bg).not.toContain('getNextIndicesForAddress');
    expect(bg).not.toContain('advanceWatermark');
  });
});

// ─── AUD-008: per-window verify nonce ─────────────────────────────────────────

describe('AUD-008 — verify challenge is window/nonce scoped', () => {
  test('the global singleton challenge is gone', () => {
    expect(bg).not.toMatch(/pendingVerifyChallenge\b/);
  });

  test('challenges are tracked by window and nonce', () => {
    expect(bg).toContain('const pendingVerifyChallenges = new Map<number, PendingVerification>();');
    expect(bg).toContain('const pendingVerifyByNonce = new Map<string, PendingVerification>();');
  });

  test('the popup URL carries a per-request nonce', () => {
    expect(bg).toContain('}?nonce=${encodeURIComponent(requestNonce)}');
    expect(bg).toContain('encodeURIComponent(requestNonce)');
  });

  test('verify:getChallenge requires and matches the nonce', () => {
    const handler = bg.slice(
      bg.indexOf("if (message.method === 'verify:getChallenge')"),
      bg.indexOf("if (message.type === 'unlock-approval')")
    );
    expect(handler).toContain('record.requestNonce === requestNonce');
    expect(handler).toContain('windowMatches');
  });

  test('verify-approval only clears the matching window entry', () => {
    const handler = bg.slice(
      bg.indexOf("if (message.type === 'verify-approval')"),
      bg.indexOf("if (message.method === 'verify:getChallenge')")
    );
    expect(handler).toContain('pendingVerifyChallenges.delete(record.windowId)');
    expect(handler).toContain('pendingVerifyByNonce.delete(record.requestNonce)');
  });

  test('verify UI echoes the nonce back to the background', () => {
    expect(verifyUi).toContain('REQUEST_NONCE');
    expect(verifyUi).toContain('nonce: REQUEST_NONCE');
  });
});

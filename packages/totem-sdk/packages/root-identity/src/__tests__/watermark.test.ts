/**
 * UnifiedIdentityWallet watermark persistence tests
 *
 * Verifies that getWatermarkState() / restoreWatermarkState() correctly
 * snapshot and restore per-slot counters across simulated sessions.
 */

import { UnifiedIdentityWallet } from '../UnifiedIdentityWallet.js';

const SEED_32 = new Uint8Array(32).fill(0xab);

describe('UnifiedIdentityWallet — getWatermarkState / restoreWatermarkState', () => {
  it('initial state has rootUses=0 and empty childUses', () => {
    const wallet = new UnifiedIdentityWallet(SEED_32, 4);
    const state = wallet.getWatermarkState();
    expect(state.rootUses).toBe(0);
    expect(Object.keys(state.childUses)).toHaveLength(0);
  });

  it('records root uses after signing', () => {
    const wallet = new UnifiedIdentityWallet(SEED_32, 4);
    wallet.signFromRoot('hello');
    wallet.signFromRoot('world');
    const state = wallet.getWatermarkState();
    expect(state.rootUses).toBe(2);
  });

  it('records child uses per index independently', () => {
    const wallet = new UnifiedIdentityWallet(SEED_32, 4);
    wallet.signFromChild(0, 'msg-a');
    wallet.signFromChild(2, 'msg-b');
    wallet.signFromChild(2, 'msg-c');
    const state = wallet.getWatermarkState();
    expect(state.childUses[0]).toBe(1);
    expect(state.childUses[1]).toBeUndefined();
    expect(state.childUses[2]).toBe(2);
    expect(state.childUses[3]).toBeUndefined();
  });

  it('restores watermarks across session boundary', () => {
    const wallet1 = new UnifiedIdentityWallet(SEED_32, 4);
    wallet1.signFromRoot('r1');
    wallet1.signFromRoot('r2');
    wallet1.signFromChild(1, 'c1');
    wallet1.signFromChild(1, 'c2');
    wallet1.signFromChild(1, 'c3');
    const snapshot = wallet1.getWatermarkState();

    const wallet2 = new UnifiedIdentityWallet(SEED_32, 4);
    wallet2.restoreWatermarkState(snapshot);

    expect(wallet2.getRootUses()).toBe(2);
    expect(wallet2.getChildUses(1)).toBe(3);
    expect(wallet2.getChildUses(0)).toBe(0);
  });

  it('restoreWatermarkState ignores out-of-range child indices', () => {
    const wallet = new UnifiedIdentityWallet(SEED_32, 2);
    wallet.restoreWatermarkState({ rootUses: 5, childUses: { 0: 3, 99: 7, 1: 1 } });
    expect(wallet.getRootUses()).toBe(5);
    expect(wallet.getChildUses(0)).toBe(3);
    expect(wallet.getChildUses(1)).toBe(1);
  });

  it('restoreWatermarkState ignores negative values', () => {
    const wallet = new UnifiedIdentityWallet(SEED_32, 2);
    wallet.restoreWatermarkState({ rootUses: -1, childUses: { 0: -5 } });
    expect(wallet.getRootUses()).toBe(0);
    expect(wallet.getChildUses(0)).toBe(0);
  });

  it('round-trips through JSON serialization', () => {
    const wallet1 = new UnifiedIdentityWallet(SEED_32, 4);
    wallet1.signFromRoot('x');
    wallet1.signFromChild(3, 'y');
    const json = JSON.stringify(wallet1.getWatermarkState());

    const wallet2 = new UnifiedIdentityWallet(SEED_32, 4);
    wallet2.restoreWatermarkState(JSON.parse(json));
    expect(wallet2.getRootUses()).toBe(1);
    expect(wallet2.getChildUses(3)).toBe(1);
  });
});

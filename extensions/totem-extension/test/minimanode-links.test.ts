/**
 * MinimaNode explorer links.
 *
 * Regression: the transaction detail page built `https://minimanode.com/#/<txid>`
 * — the extension popup's own deep-link shape — instead of the explorer's
 * `#/tx/<txid>`. MinimaNode's router matches on the `tx/` prefix and falls back
 * to the dashboard for anything else, so the link silently lost the
 * transaction. These tests pin the shape.
 */

import { MINIMANODE_TX_BASE, minimanodeTxUrl } from '../src/core/links/minimanode';

const TXID = '0x' + 'a1'.repeat(32);

describe('minimanodeTxUrl', () => {
  it('uses the explorer tx route, not the popup hash', () => {
    expect(minimanodeTxUrl(TXID)).toBe(`https://minimanode.com/#/tx/${TXID}`);
    expect(MINIMANODE_TX_BASE).toBe('https://minimanode.com/#/tx');
  });

  it('never produces the bare-hash form that renders the dashboard', () => {
    expect(minimanodeTxUrl(TXID)).not.toBe(`https://minimanode.com/#/${TXID}`);
    expect(minimanodeTxUrl(TXID)).toContain('/#/tx/');
  });

  it('trims surrounding whitespace', () => {
    expect(minimanodeTxUrl(`  ${TXID}\n`)).toBe(`https://minimanode.com/#/tx/${TXID}`);
  });

  it('returns empty for missing or unbroadcast ids', () => {
    expect(minimanodeTxUrl('')).toBe('');
    expect(minimanodeTxUrl(undefined)).toBe('');
    expect(minimanodeTxUrl(null)).toBe('');
    expect(minimanodeTxUrl('pending-123')).toBe('');
  });
});

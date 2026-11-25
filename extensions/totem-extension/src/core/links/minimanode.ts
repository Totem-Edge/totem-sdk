/**
 * Canonical MinimaNode links.
 *
 * MinimaNode is a hash-routed explorer: a transaction lives at
 * `https://minimanode.com/#/tx/<txpowid>`. The prefix is required — the router
 * matches on `tx/` and silently renders the dashboard for anything else, which
 * is how `#/<txpowid>` (the *extension popup's* own deep-link shape) ended up
 * sending users to the explorer home page with their transaction dropped.
 *
 * Keep every explorer link in the extension going through this module so the
 * two hash shapes cannot be confused again.
 */

export const MINIMANODE_TX_BASE = 'https://minimanode.com/#/tx';

/** Transaction detail URL, or '' when there is no broadcast id yet. */
export function minimanodeTxUrl(txpowid: string | null | undefined): string {
  const id = String(txpowid ?? '').trim();
  if (!id || id.startsWith('pending-')) return '';
  return `${MINIMANODE_TX_BASE}/${id}`;
}

/**
 * Optimistic send tracking.
 *
 * A send is visible on-chain a block or two after broadcast, but the portfolio
 * cache/WS can take ~90 s to reflect it. Keep the submitted send here so Home
 * can subtract it from the balance immediately and show a "processing" banner.
 * The entry is removed when the balance catches up, the tx detail confirms, or
 * it ages out.
 */
import { useEffect, useState } from 'react';

export interface PendingSend {
  txpowid: string;
  address: string;
  tokenId: string;
  /** Display units, e.g. "0.1". */
  amount: string;
  /** Confirmed balance for this token at the moment of sending. */
  balanceBefore: string;
  createdAt: number;
}

const STORAGE_KEY = 'totem_pending_sends_v1';
const MAX_AGE_MS = 15 * 60_000;

let cache: PendingSend[] | null = null;
const listeners = new Set<() => void>();

function load(): PendingSend[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PendingSend[]) : [];
    const now = Date.now();
    cache = Array.isArray(parsed)
      ? parsed.filter(p => p && typeof p.txpowid === 'string' && now - p.createdAt < MAX_AGE_MS)
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache ?? []));
  } catch {
    /* storage unavailable */
  }
}

function emit(): void {
  listeners.forEach(fn => {
    try { fn(); } catch { /* ignore */ }
  });
}

export function getPendingSends(address?: string): PendingSend[] {
  const all = load();
  return address ? all.filter(p => p.address === address) : all;
}

export function addPendingSend(input: Omit<PendingSend, 'createdAt'> & { createdAt?: number }): void {
  const all = load().filter(p => p.txpowid !== input.txpowid);
  all.push({ ...input, createdAt: input.createdAt ?? Date.now() });
  cache = all;
  persist();
  emit();
}

export function removePendingSend(txpowid: string): void {
  const all = load();
  const next = all.filter(p => p.txpowid !== txpowid);
  if (next.length === all.length) return;
  cache = next;
  persist();
  emit();
}

export function clearPendingSends(address?: string): void {
  const all = load();
  const next = address ? all.filter(p => p.address !== address) : [];
  cache = next;
  persist();
  emit();
}

export function subscribePendingSends(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePendingSends(address?: string): PendingSend[] {
  const [value, setValue] = useState<PendingSend[]>(() => getPendingSends(address));

  useEffect(() => {
    const update = () => setValue(getPendingSends(address));
    update();
    return subscribePendingSends(update);
  }, [address]);

  return value;
}

/** Subtract display amounts without turning 0.1 - 0.1 into 0.099999…. */
export function subtractAmount(amount: string, ...deltas: string[]): string {
  let value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  if (deltas.length === 0) return amount;
  let scale = 0;
  for (const s of [amount, ...deltas]) {
    const dot = s.indexOf('.');
    if (dot >= 0) scale = Math.max(scale, s.length - dot - 1);
  }
  for (const delta of deltas) value -= Number(delta);
  if (!Number.isFinite(value) || value <= 0) return '0';
  const fixed = value.toFixed(Math.min(Math.max(scale, 2), 18));
  // Only trim fractional zeros — "100" must stay "100", not "1".
  return fixed.includes('.') ? (fixed.replace(/0+$/, '').replace(/\.$/, '') || '0') : fixed;
}

/** Sum of the pending sends for one token, as a display string. */
export function pendingAmountFor(sends: PendingSend[], tokenId: string): string {
  const matching = sends.filter((p) => p.tokenId.toLowerCase() === tokenId.toLowerCase());
  if (matching.length === 0) return '0';
  let total = 0;
  let scale = 0;
  for (const p of matching) {
    total += Number(p.amount);
    const dot = p.amount.indexOf('.');
    if (dot >= 0) scale = Math.max(scale, p.amount.length - dot - 1);
  }
  if (!Number.isFinite(total) || total <= 0) return '0';
  const fixed = total.toFixed(Math.min(scale, 18));
  return fixed.includes('.') ? (fixed.replace(/0+$/, '').replace(/\.$/, '') || '0') : fixed;
}

/**
 * Confirmed balance with this wallet's in-flight sends subtracted.
 *
 * `confirmed` stays authoritative; this only affects what Home/TokenDetail
 * render while the archive index catches up.
 */
export function effectiveBalance(
  confirmed: string,
  sends: PendingSend[],
  tokenId: string
): string {
  const pending = pendingAmountFor(sends, tokenId);
  if (pending === '0') return confirmed;
  return subtractAmount(confirmed, pending);
}

interface BalanceLike {
  tokenid: string;
  confirmed: string;
}

/**
 * Drop pending sends the chain has caught up with.
 *
 * A send is settled when the token's confirmed balance has fallen by at least
 * the amount that was sent (recorded as `balanceBefore` at submit time).
 * Balance-before handles several sends from the same coin set correctly: each
 * entry is removed independently as the confirmed number steps down.
 */
export function reconcilePendingSends(address: string, entries: BalanceLike[]): void {
  const sends = getPendingSends(address);
  if (sends.length === 0) return;

  const byToken = new Map<string, BalanceLike>();
  for (const entry of entries) byToken.set(entry.tokenid.toLowerCase(), entry);

  for (const send of sends) {
    const entry = byToken.get(send.tokenId.toLowerCase());
    if (!entry) continue;
    const confirmed = Number(entry.confirmed);
    const before = Number(send.balanceBefore);
    const amount = Number(send.amount);
    if (!Number.isFinite(confirmed) || !Number.isFinite(before) || !Number.isFinite(amount)) continue;
    // Small epsilon so 0.1 - 0.1 does not stay pending forever on float noise.
    // When balanceBefore was unavailable (deep link, no portfolio yet) the
    // only safe signal is the token reaching zero.
    const settled = before > 0
      ? confirmed <= before - amount + 1e-12
      : confirmed <= 0;
    if (settled) {
      removePendingSend(send.txpowid);
    }
  }
}

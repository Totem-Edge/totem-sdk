/**
 * Shared display formatting for the wallet UI.
 *
 * One formatter per concern, so the activity list, detail view and portfolio
 * cannot drift apart (they previously rendered the same amount differently).
 */

import { decodeMinimaAmount, scaleTokenAmount } from '../../../constants';

export { decodeMinimaAmount, scaleTokenAmount };

/** Trim trailing fractional zeros and a dangling decimal point. */
function trimZeros(value: string): string {
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/**
 * Amount for display: up to 6 significant digits, trailing zeros trimmed.
 * Very small values use exponential form (0.000…099 has 35 decimals and is
 * unreadable in fixed notation).
 */
export function formatAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (n === 0) return '0';

  const abs = Math.abs(n);
  if (abs >= 1e-6) {
    const digits = Math.max(0, 6 - Math.floor(Math.log10(abs)) - 1);
    return trimZeros(n.toFixed(Math.min(digits, 12)));
  }
  return trimZeros(n.toExponential(5)).replace('e+', 'e');
}

/** Group the integer part with thin spaces: 1234567.8 -> 1 234 567.8 */
export function groupThousands(formatted: string): string {
  if (/e/i.test(formatted)) return formatted;
  const [whole, fraction] = formatted.split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const digits = sign ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** Signed amount with grouping, e.g. "-0.9", "+0.8", "+1". */
export function formatSignedAmount(amount: string, isSend: boolean): string {
  const body = groupThousands(formatAmount(amount));
  return `${isSend ? '–' : '+'}${body}`;
}

/** True when an event carries no value (a state-only update). */
export function isZeroAmount(amount: string | null | undefined): boolean {
  if (!amount) return true;
  const n = Number(amount);
  return Number.isFinite(n) && n === 0;
}

/** 0x + first 6 + … + last 4, matching the list and detail views. */
export function shortAddress(address: string): string {
  if (!address) return '';
  const hasPrefix = address.startsWith('0x') || address.startsWith('Mx');
  const body = hasPrefix ? address.slice(2) : address;
  if (body.length <= 12) return address;
  return `${hasPrefix ? address.slice(0, 2) : ''}${body.slice(0, 6)}…${body.slice(-4)}`;
}

/** Token label: MINIMA, the resolved name/ticker, or a 0x05…FE chip. */
export function tokenLabel(
  tokenid: string | undefined,
  tokens: Record<string, { name?: string; ticker?: string }>
): { label: string; known: boolean } {
  if (!tokenid || tokenid === '0x00' || tokenid === '0x0000') {
    return { label: 'MINIMA', known: true };
  }
  const key = tokenid.toLowerCase();
  const token = tokens[key];
  const label = token?.ticker || token?.name;
  if (label) return { label, known: true };
  const body = key.replace(/^0x/, '').toUpperCase();
  return { label: `0x${body.slice(0, 4)}…${body.slice(-2)}`, known: false };
}

export interface WhenLabel {
  /** Compact label for the row: "just now", "12m", "3h", "18 Nov", "18 Nov 2025". */
  short: string;
  /** Full timestamp for the tooltip. */
  full: string;
  /** Local day bucket used for the sticky headers. */
  dayKey: string;
}

/** Relative for the last 24h, day+month this year, day+month+year otherwise. */
export function formatWhen(value: string | number | Date): WhenLabel {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const raw = String(value);
    return { short: raw, full: raw, dayKey: 'Unknown' };
  }

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  let short: string;
  if (diff < 60_000) short = 'just now';
  else if (diff < 3_600_000) short = `${Math.floor(diff / 60_000)}m`;
  else if (diff < 86_400_000) short = `${Math.floor(diff / 3_600_000)}h`;
  else {
    short = date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    });
  }

  const dayKey = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });

  return { short, full: date.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'medium' }), dayKey };
}

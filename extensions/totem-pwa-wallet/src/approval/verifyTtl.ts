/**
 * How long a returned TOTEM_VERIFY result claims to be valid.
 *
 * Callers can cap this with `challenge.expiryMs` (Totem's own /api/auth/challenge
 * issues a 5-minute nonce and rejects any longer claim). The approval pages used
 * to hardcode an hour, which servers correctly refused, so the default must match
 * the extension's ChallengeBuilder instead of being picked ad hoc.
 */
export const DEFAULT_VERIFY_TTL_MS = 5 * 60 * 1000;

const MIN_VERIFY_TTL_MS = 30 * 1000;

/**
 * No server should accept a verification older than this. A long-lived claim
 * buys nothing: the session is minted server-side.
 */
const MAX_VERIFY_TTL_MS = 10 * 60 * 1000;

export function resolveVerifyTtlMs(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return DEFAULT_VERIFY_TTL_MS;
  const requested = Number(raw);
  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_VERIFY_TTL_MS;
  return Math.min(Math.max(requested, MIN_VERIFY_TTL_MS), MAX_VERIFY_TTL_MS);
}

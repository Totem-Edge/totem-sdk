import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';

/**
 * TimeWindowPolicy — only approves proposals during a configurable
 * daily time window (e.g. business hours 06:00 – 22:00 UTC).
 *
 * Times are specified in **minutes since midnight UTC**. Use helpers:
 * - `TimeWindowPolicy.hour(6)`   → 360   (06:00)
 * - `TimeWindowPolicy.hour(22)`  → 1320  (22:00)
 *
 * Proposals outside the window are rejected with the time until the
 * next opening so the agent can schedule a retry.
 *
 * @example
 * ```ts
 * // Only allow proposals between 06:00 and 22:00 UTC
 * const businessHours = new TimeWindowPolicy(360, 1320);
 * ```
 */
export class TimeWindowPolicy implements PolicyMiddleware {
  private readonly startMinute: number;
  private readonly endMinute: number;

  /**
   * @param startMinute Minutes since midnight UTC when the window opens (0–1439).
   * @param endMinute   Minutes since midnight UTC when the window closes (1–1440).
   */
  constructor(startMinute: number, endMinute: number) {
    if (startMinute < 0 || startMinute > 1439) {
      throw new Error('startMinute must be 0–1439');
    }
    if (endMinute < 1 || endMinute > 1440) {
      throw new Error('endMinute must be 1–1440');
    }
    if (startMinute >= endMinute) {
      throw new Error('startMinute must be before endMinute');
    }
    this.startMinute = startMinute;
    this.endMinute = endMinute;
  }

  /** Convenience: convert an hour (0–23) to minutes since midnight. */
  static hour(h: number): number {
    if (h < 0 || h > 23) throw new Error('hour must be 0–23');
    return h * 60;
  }

  async evaluate(proposal: AgentProposal): Promise<PolicyEvalResult> {
    const now = new Date();
    const currentMinute = now.getUTCHours() * 60 + now.getUTCMinutes();

    if (currentMinute >= this.startMinute && currentMinute < this.endMinute) {
      return { outcome: 'approved', reason: 'Within allowed time window' };
    }

    const minutesUntilOpen =
      currentMinute < this.startMinute
        ? this.startMinute - currentMinute
        : (1440 - currentMinute) + this.startMinute;

    const h = Math.floor(minutesUntilOpen / 60);
    const m = minutesUntilOpen % 60;
    return {
      outcome: 'rejected',
      reason: `Outside time window (${this.formatMinute(this.startMinute)}–${this.formatMinute(this.endMinute)} UTC). Opens in ${h}h ${m}m`,
    };
  }

  private formatMinute(m: number): string {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}

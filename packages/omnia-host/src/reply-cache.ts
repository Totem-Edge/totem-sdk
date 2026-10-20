/**
 * Idempotent request/reply support for peer proposals.
 *
 * A requester resends a proposal when the transport reconnects (the proposal or
 * its reply may have been lost). The responder must then:
 *   - never sign/allocate a second time for the same logical request, and
 *   - return the exact same reply so the requester sees a consistent result.
 *
 * Keyed by `(type, kind, channelId, nonce)`; concurrent duplicates await the
 * in-flight execution instead of starting a second one.
 */
export class ReplyCache {
  private readonly _replies = new Map<string, { reply: unknown; at: number }>();
  private readonly _inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly _maxEntries = 512,
    private readonly _ttlMs = 10 * 60_000,
  ) {}

  key(type: string, channelId: string, nonce: number | undefined, kind?: string): string {
    return [type, kind ?? '', channelId, nonce ?? ''].join(':');
  }

  async run<T>(key: string, fn: () => Promise<T | null>): Promise<T | null> {
    const cached = this._replies.get(key);
    if (cached) {
      if (Date.now() - cached.at < this._ttlMs) return cached.reply as T;
      this._replies.delete(key);
    }

    const inFlight = this._inFlight.get(key);
    if (inFlight) return inFlight as Promise<T | null>;

    const promise = (async () => {
      try {
        const reply = await fn();
        if (reply !== null) {
          this._replies.set(key, { reply, at: Date.now() });
          this._evict();
        }
        return reply;
      } finally {
        this._inFlight.delete(key);
      }
    })();

    this._inFlight.set(key, promise as Promise<unknown>);
    return promise;
  }

  private _evict(): void {
    while (this._replies.size > this._maxEntries) {
      const oldest = this._replies.keys().next().value;
      if (oldest === undefined) break;
      this._replies.delete(oldest);
    }
  }
}

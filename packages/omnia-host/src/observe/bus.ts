import type { OmniaObservation } from "./types.js";

export type ObservationListener = (observation: OmniaObservation) => void;

/**
 * In-process live fan-out for SSE consumers. The durable journal remains the
 * source of truth: a subscriber that misses a live event still replays it from
 * `ObservationStore.readSince(cursor)`.
 */
export class ObservationBus {
  private readonly listeners = new Set<ObservationListener>();

  subscribe(listener: ObservationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(observation: OmniaObservation): void {
    for (const listener of this.listeners) {
      try {
        listener(observation);
      } catch {
        // A broken consumer must never break the mutation path.
      }
    }
  }

  get size(): number {
    return this.listeners.size;
  }
}

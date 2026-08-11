export interface AnalyticsEvent {
  eventId: string;
  kind: string;
  occurredAt: number;
  channelId?: string;
  operationId?: string;
  payload: Record<string, unknown>;
}

export interface AnalyticsStore {
  append(event: AnalyticsEvent): Promise<void>;
  query(kind?: string, limit?: number): Promise<AnalyticsEvent[]>;
  close(): Promise<void>;
}

/**
 * No-op analytics backend for phase 9 deployments without DuckDB enabled.
 * The interface keeps analytics off the channel critical path.
 */
export class DisabledAnalyticsStore implements AnalyticsStore {
  async append(_event: AnalyticsEvent): Promise<void> {}
  async query(_kind?: string, _limit?: number): Promise<AnalyticsEvent[]> { return []; }
  async close(): Promise<void> {}
}

/** Adapter boundary for the optional DuckDB implementation. */
export interface DuckDbConnection {
  run(sql: string, ...params: unknown[]): Promise<void>;
  all<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

export class DuckDbAnalyticsStore implements AnalyticsStore {
  constructor(private readonly db: DuckDbConnection) {}

  async append(event: AnalyticsEvent): Promise<void> {
    await this.db.run(
      `INSERT INTO omnia_events (event_id, kind, occurred_at, channel_id, operation_id, payload_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      event.eventId,
      event.kind,
      event.occurredAt,
      event.channelId ?? null,
      event.operationId ?? null,
      JSON.stringify(event.payload),
    );
  }

  async query(kind?: string, limit = 100): Promise<AnalyticsEvent[]> {
    const rows = await this.db.all<{
      event_id: string;
      kind: string;
      occurred_at: number;
      channel_id?: string;
      operation_id?: string;
      payload_json: string;
    }>(
      kind
        ? 'SELECT * FROM omnia_events WHERE kind = ? ORDER BY occurred_at DESC LIMIT ?'
        : 'SELECT * FROM omnia_events ORDER BY occurred_at DESC LIMIT ?',
      ...(kind ? [kind, limit] : [limit]),
    );
    return rows.map((row) => ({
      eventId: row.event_id,
      kind: row.kind,
      occurredAt: row.occurred_at,
      channelId: row.channel_id,
      operationId: row.operation_id,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    }));
  }

  close(): Promise<void> {
    return this.db.close();
  }
}

export async function initializeDuckDb(db: DuckDbConnection): Promise<void> {
  await db.run(`
    CREATE TABLE IF NOT EXISTS omnia_events (
      event_id VARCHAR PRIMARY KEY,
      kind VARCHAR NOT NULL,
      occurred_at BIGINT NOT NULL,
      channel_id VARCHAR,
      operation_id VARCHAR,
      payload_json VARCHAR NOT NULL
    )
  `);
}

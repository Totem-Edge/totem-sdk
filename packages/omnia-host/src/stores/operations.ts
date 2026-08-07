import Database from 'better-sqlite3';

export type OperationStatus = 'pending' | 'reserved' | 'executing' | 'committed' | 'failed' | 'unknown';

export interface OperationRecord {
  operationId: string;
  status: OperationStatus;
  createdAt: number;
  updatedAt: number;
  request?: unknown;
  result?: unknown;
  error?: string;
}

interface OperationRow {
  operation_id: string;
  status: OperationStatus;
  created_at: number;
  updated_at: number;
  request_json: string | null;
  result_json: string | null;
  error: string | null;
}

function encode(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function decode(value: string | null): unknown {
  return value === null ? undefined : JSON.parse(value);
}

function toRecord(row: OperationRow): OperationRecord {
  return {
    operationId: row.operation_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    request: decode(row.request_json),
    result: decode(row.result_json),
    error: row.error ?? undefined,
  };
}

/** Durable operation journal with atomic status transitions. */
export class OperationStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS omnia_operations (
        operation_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        request_json TEXT,
        result_json TEXT,
        error TEXT
      )
    `);
  }

  get(operationId: string): OperationRecord | undefined {
    const row = this.db.prepare(
      'SELECT * FROM omnia_operations WHERE operation_id = ?',
    ).get(operationId) as OperationRow | undefined;
    return row ? toRecord(row) : undefined;
  }

  create(operationId: string, request?: unknown, now = Date.now()): OperationRecord {
    this.db.prepare(`
      INSERT OR IGNORE INTO omnia_operations
        (operation_id, status, created_at, updated_at, request_json)
      VALUES (?, 'pending', ?, ?, ?)
    `).run(operationId, now, now, encode(request));
    const record = this.get(operationId);
    if (!record) throw new Error(`Failed to create operation ${operationId}`);
    return record;
  }

  transition(
    operationId: string,
    from: OperationStatus,
    to: OperationStatus,
    patch: { result?: unknown; error?: string } = {},
    now = Date.now(),
  ): OperationRecord {
    const result = this.db.prepare(`
      UPDATE omnia_operations
      SET status = ?, updated_at = ?, result_json = ?, error = ?
      WHERE operation_id = ? AND status = ?
    `).run(to, now, encode(patch.result), patch.error ?? null, operationId, from);

    if (result.changes !== 1) {
      const current = this.get(operationId);
      if (!current) throw new Error(`Unknown operation ${operationId}`);
      throw new Error(
        `Operation ${operationId} expected status ${from} but is ${current.status}`,
      );
    }

    return this.get(operationId)!;
  }

  listByStatus(status: OperationStatus): OperationRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM omnia_operations WHERE status = ? ORDER BY created_at',
    ).all(status) as OperationRow[];
    return rows.map(toRecord);
  }

  close(): void {
    this.db.close();
  }
}

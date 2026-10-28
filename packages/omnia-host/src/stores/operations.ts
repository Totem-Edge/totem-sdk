import { createHash } from 'node:crypto';
import { SyncSqliteStore } from '@totemsdk/storage/sqlite-sync';

export type OperationStatus = 'pending' | 'reserved' | 'executing' | 'committed' | 'failed' | 'unknown';

export interface OperationRecord {
  operationId: string;
  status: OperationStatus;
  createdAt: number;
  updatedAt: number;
  request?: unknown;
  requestDigest?: string;
  result?: unknown;
  error?: string;
}


export class OperationConflictError extends Error {
  readonly code: 'operation-conflict' | 'operation-in-progress' | 'operation-result-missing';
  readonly operationId: string;
  readonly status: OperationStatus;
  constructor(
    code: 'operation-conflict' | 'operation-in-progress' | 'operation-result-missing',
    operationId: string,
    status: OperationStatus,
    message: string,
  ) {
    super(message);
    this.name = 'OperationConflictError';
    this.code = code;
    this.operationId = operationId;
    this.status = status;
  }
}

const PREFIX = 'omnia:operation:';
const FORMAT_KEY = 'omnia:store:operation:format';
const STORE_FORMAT = 1;

/**
 * CAN-001: operation requests/results can carry `bigint` amounts. The storage
 * codec tags bigints natively, so the record is persisted as-is. Legacy
 * `omnia_operations` rows (JSON with `{$bigint}` tags) are migrated on open.
 */
function decodeLegacy(value: string | null): unknown {
  if (value === null) return undefined;
  return JSON.parse(value, (_key, nested: unknown) => {
    if (
      nested !== null &&
      typeof nested === 'object' &&
      typeof (nested as { $bigint?: unknown }).$bigint === 'string' &&
      Object.keys(nested as Record<string, unknown>).length === 1
    ) {
      return BigInt((nested as { $bigint: string }).$bigint);
    }
    return nested;
  });
}

/** Durable operation journal with atomic status transitions, via storage SDK. */
export class OperationStore {
  private readonly kv: SyncSqliteStore;

  constructor(dbPath: string) {
    this.kv = new SyncSqliteStore(dbPath);
    const version = this.kv.get<number>(FORMAT_KEY);
    if (version !== null && version !== STORE_FORMAT) {
      this.kv.close();
      throw new Error(
        `Unsupported OperationStore format ${version} (this build supports ${STORE_FORMAT}) — refusing to open`,
      );
    }
    if (version === null) this.migrateLegacy();
  }

  private migrateLegacy(): void {
    // One-time migration from the pre-storage direct-SQLite table.
    this.kv.migrateLegacyTable<OperationRecord>('omnia_operations', (row) => {
      const request = decodeLegacy((row['request_json'] as string | null) ?? null);
      const result = decodeLegacy((row['result_json'] as string | null) ?? null);
      const digestValue = row['request_digest'] ? String(row['request_digest']) : undefined;
      const error = row['error'] ? String(row['error']) : undefined;
      const record: OperationRecord = {
        operationId: String(row['operation_id']),
        status: (row['status'] as OperationStatus) ?? 'unknown',
        createdAt: Number(row['created_at']),
        updatedAt: Number(row['updated_at']),
        ...(request !== undefined ? { request } : {}),
        ...(digestValue ? { requestDigest: digestValue } : {}),
        ...(result !== undefined ? { result } : {}),
        ...(error ? { error } : {}),
      };
      return { key: PREFIX + record.operationId, value: record };
    });
    this.kv.set(FORMAT_KEY, STORE_FORMAT);
  }

  get(operationId: string): OperationRecord | undefined {
    return this.kv.get<OperationRecord>(PREFIX + operationId) ?? undefined;
  }

  create(operationId: string, request?: unknown, now = Date.now()): OperationRecord {
    return this.kv.transaction(() => {
      const existing = this.get(operationId);
      if (existing) return existing;
      const record: OperationRecord = {
        operationId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        ...(request !== undefined ? { request } : {}),
        requestDigest: digest(request),
      };
      this.kv.set(PREFIX + operationId, record);
      return record;
    });
  }

  verifyRequest(operationId: string, request: unknown): boolean {
    const record = this.get(operationId);
    return !record?.requestDigest || record.requestDigest === digest(request);
  }

  transition(
    operationId: string,
    from: OperationStatus,
    to: OperationStatus,
    patch: { result?: unknown; error?: string } = {},
    now = Date.now(),
  ): OperationRecord {
    return this.kv.transaction(() => {
      const record = this.get(operationId);
      if (!record) throw new Error(`Unknown operation ${operationId}`);
      if (record.status !== from) {
        throw new Error(`Operation ${operationId} expected status ${from} but is ${record.status}`);
      }
      const next: OperationRecord = {
        ...record,
        status: to,
        updatedAt: now,
        ...(patch.error !== undefined ? { error: patch.error } : {}),
        ...(patch.result !== undefined ? { result: patch.result } : {}),
      };
      this.kv.set(PREFIX + operationId, next);
      return next;
    });
  }

  listByStatus(status: OperationStatus): OperationRecord[] {
    return this.kv
      .keys()
      .filter((key) => key.startsWith(PREFIX))
      .map((key) => this.kv.get<OperationRecord>(key))
      .filter((record): record is OperationRecord => record !== null)
      .filter((record) => record.status === status)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  close(): void {
    this.kv.close();
  }
}

function canonical(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'bigint') return `{"$bigint":${JSON.stringify(value.toString())}}`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

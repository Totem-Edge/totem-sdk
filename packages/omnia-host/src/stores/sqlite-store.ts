import Database from 'better-sqlite3';
import type { OmniaChannel } from '@totemsdk/omnia';

const BIGINT_TAG = '__omniaBigInt';

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (typeof nested === 'bigint') return { [BIGINT_TAG]: nested.toString() };
    return nested;
  });
}

function deserialize<T>(value: string): T {
  return JSON.parse(value, (_key, nested: unknown) => {
    if (
      nested &&
      typeof nested === 'object' &&
      BIGINT_TAG in nested &&
      typeof (nested as Record<string, unknown>)[BIGINT_TAG] === 'string'
    ) {
      return BigInt((nested as Record<string, string>)[BIGINT_TAG]);
    }
    return nested;
  }) as T;
}

function durableSnapshot(channel: OmniaChannel): OmniaChannel {
  // Signer functions are runtime capabilities and must never be persisted.
  const { localSigner: _localSigner, ...snapshot } = channel;
  return snapshot;
}

function iterator<T>(values: T[]): MapIterator<T> {
  let index = 0;
  return {
    next(): IteratorResult<T> {
      if (index >= values.length) return { done: true, value: undefined };
      return { done: false, value: values[index++] };
    },
    [Symbol.iterator](): MapIterator<T> {
      return this;
    },
    [Symbol.dispose](): void {
      index = values.length;
    },
  };
}

/** SQLite-backed Map facade accepted by @totemsdk/omnia's ChannelStore type. */
export class SqliteChannelStore extends Map<string, OmniaChannel> {
  private readonly db: Database.Database;
  private readonly readStatement: Database.Statement;
  private readonly writeStatement: Database.Statement;
  private readonly deleteStatement: Database.Statement;

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS omnia_channels (
        channel_id TEXT PRIMARY KEY,
        channel_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    this.readStatement = this.db.prepare(
      'SELECT channel_json FROM omnia_channels WHERE channel_id = ?',
    );
    this.writeStatement = this.db.prepare(`
      INSERT INTO omnia_channels (channel_id, channel_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(channel_id) DO UPDATE SET
        channel_json = excluded.channel_json,
        updated_at = excluded.updated_at
    `);
    this.deleteStatement = this.db.prepare('DELETE FROM omnia_channels WHERE channel_id = ?');
  }

  override get(channelId: string): OmniaChannel | undefined {
    const row = this.readStatement.get(channelId) as { channel_json: string } | undefined;
    return row ? deserialize<OmniaChannel>(row.channel_json) : undefined;
  }

  override set(channelId: string, channel: OmniaChannel): this {
    this.writeStatement.run(channelId, serialize(durableSnapshot(channel)), Date.now());
    return this;
  }

  override has(channelId: string): boolean {
    return this.readStatement.get(channelId) !== undefined;
  }

  override delete(channelId: string): boolean {
    return this.deleteStatement.run(channelId).changes > 0;
  }

  override clear(): void {
    this.db.exec('DELETE FROM omnia_channels');
  }

  override get size(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM omnia_channels').get() as { count: number };
    return row.count;
  }

  override entries(): MapIterator<[string, OmniaChannel]> {
    const rows = this.db.prepare(
      'SELECT channel_id, channel_json FROM omnia_channels ORDER BY channel_id',
    ).iterate() as Iterable<{ channel_id: string; channel_json: string }>;
    return iterator(Array.from(rows, (row) => [
      row.channel_id,
      deserialize<OmniaChannel>(row.channel_json),
    ]));
  }

  override keys(): MapIterator<string> {
    return iterator(Array.from(this.entries(), ([channelId]) => channelId));
  }

  override values(): MapIterator<OmniaChannel> {
    return iterator(Array.from(this.entries(), ([, channel]) => channel));
  }

  override [Symbol.iterator](): MapIterator<[string, OmniaChannel]> {
    return this.entries();
  }

  override forEach(callbackfn: (value: OmniaChannel, key: string, map: Map<string, OmniaChannel>) => void): void {
    for (const [key, value] of this.entries()) callbackfn(value, key, this);
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Jest-only stand-in for the `better-sqlite3` native module.
 *
 * better-sqlite3 ships a prebuilt .node addon that cannot be built or
 * downloaded in the offline sandbox. Node 22 ships a built-in SQLite
 * (`node:sqlite`) whose synchronous API is a near drop-in replacement, so
 * this mock forwards the handful of better-sqlite3 methods used by
 * SqliteStore onto `DatabaseSync`.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

const { DatabaseSync } = require('node:sqlite');

const toBuffer = (v) => (v instanceof Uint8Array ? Buffer.from(v) : v);

class Database {
  constructor(path) {
    this._db = new DatabaseSync(path);
  }

  exec(sql) {
    this._db.exec(sql);
  }

  prepare(sql) {
    const stmt = this._db.prepare(sql);
    return {
      run(...params) {
        const result = stmt.run(...params);
        return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
      },
      get(...params) {
        const row = stmt.get(...params);
        if (row === undefined) return undefined;
        return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, toBuffer(v)]));
      },
      all(...params) {
        return stmt.all(...params).map((row) =>
          Object.fromEntries(Object.entries(row).map(([k, v]) => [k, toBuffer(v)])),
        );
      },
    };
  }

  close() {
    this._db.close();
  }
}

module.exports = Database;

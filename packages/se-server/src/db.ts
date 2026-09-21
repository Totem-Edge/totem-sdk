import { Pool, PoolClient } from 'pg';

export async function migrateStatechainTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS statechain_records (
      chain_id                TEXT PRIMARY KEY,
      project_id              TEXT NOT NULL,
      coin_id                 TEXT NOT NULL,
      token_id                TEXT NOT NULL DEFAULT '0x00',
      statechain_script       TEXT NOT NULL,
      locking_address         TEXT NOT NULL,
      se_public_key           TEXT NOT NULL,
      current_owner_party_id  TEXT NOT NULL,
      current_owner_pkd       TEXT NOT NULL,
      transfer_count          INTEGER NOT NULL DEFAULT 0,
      version                 INTEGER NOT NULL DEFAULT 0,
      status                  TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','claimed','disputed')),
      reclaim_tx_hex_enc      TEXT NOT NULL,
      created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // AUD-027: optimistic-concurrency version for ownership transitions.
  await pool.query(`
    ALTER TABLE statechain_records
      ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS statechain_revocations (
      id                SERIAL PRIMARY KEY,
      chain_id          TEXT NOT NULL REFERENCES statechain_records(chain_id) ON DELETE CASCADE,
      revoked_party_id  TEXT NOT NULL,
      revoked_pkd       TEXT NOT NULL,
      revoked_at        TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS statechain_nonces (
      id          SERIAL PRIMARY KEY,
      chain_id    TEXT NOT NULL,
      nonce       TEXT NOT NULL UNIQUE,
      expires_at  TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS statechain_sign_log (
      id          SERIAL PRIMARY KEY,
      chain_id    TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      logged_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sc_records_project   ON statechain_records(project_id);
    CREATE INDEX IF NOT EXISTS idx_sc_records_status    ON statechain_records(status);
    CREATE INDEX IF NOT EXISTS idx_sc_revocations_chain ON statechain_revocations(chain_id);
    CREATE INDEX IF NOT EXISTS idx_sc_nonces_chain      ON statechain_nonces(chain_id);
    CREATE INDEX IF NOT EXISTS idx_sc_nonces_expires    ON statechain_nonces(expires_at);
    CREATE INDEX IF NOT EXISTS idx_sc_sign_log_chain    ON statechain_sign_log(chain_id);
  `);

  await pool.query(`DELETE FROM statechain_nonces WHERE expires_at < NOW()`);

  console.log('[se-server] DB tables migrated');
}

export interface StatechainRecord {
  chain_id: string;
  project_id: string;
  coin_id: string;
  token_id: string;
  statechain_script: string;
  locking_address: string;
  se_public_key: string;
  current_owner_party_id: string;
  current_owner_pkd: string;
  transfer_count: number;
  version: number;
  status: 'active' | 'claimed' | 'disputed';
  reclaim_tx_hex_enc: string;
  created_at: Date;
  updated_at: Date;
}

export async function insertStatechainRecord(
  pool: Pool,
  rec: Omit<StatechainRecord, 'transfer_count' | 'version' | 'status' | 'created_at' | 'updated_at'>,
): Promise<void> {
  await pool.query(
    `INSERT INTO statechain_records
      (chain_id, project_id, coin_id, token_id, statechain_script, locking_address, se_public_key,
       current_owner_party_id, current_owner_pkd, reclaim_tx_hex_enc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      rec.chain_id, rec.project_id, rec.coin_id, rec.token_id,
      rec.statechain_script, rec.locking_address, rec.se_public_key,
      rec.current_owner_party_id, rec.current_owner_pkd, rec.reclaim_tx_hex_enc,
    ],
  );
}

export async function getStatechainRecord(
  pool: Pool,
  chainId: string,
): Promise<StatechainRecord | null> {
  const r = await pool.query<StatechainRecord>(
    'SELECT * FROM statechain_records WHERE chain_id = $1',
    [chainId],
  );
  return r.rows[0] ?? null;
}

export async function updateStatechainOwner(
  pool: Pool,
  chainId: string,
  newOwnerPartyId: string,
  newOwnerPkd: string,
  newReclaimTxHexEnc: string,
): Promise<void> {
  await pool.query(
    `UPDATE statechain_records
     SET current_owner_party_id = $2,
         current_owner_pkd      = $3,
         reclaim_tx_hex_enc     = $4,
         transfer_count         = transfer_count + 1,
         updated_at             = NOW()
     WHERE chain_id = $1`,
    [chainId, newOwnerPartyId, newOwnerPkd, newReclaimTxHexEnc],
  );
}

export async function updateStatechainStatus(
  pool: Pool,
  chainId: string,
  status: 'active' | 'claimed' | 'disputed',
): Promise<void> {
  await pool.query(
    `UPDATE statechain_records SET status = $2, updated_at = NOW() WHERE chain_id = $1`,
    [chainId, status],
  );
}

export async function insertRevocation(
  pool: Pool,
  chainId: string,
  revokedPartyId: string,
  revokedPkd: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO statechain_revocations (chain_id, revoked_party_id, revoked_pkd)
     VALUES ($1, $2, $3)`,
    [chainId, revokedPartyId, revokedPkd],
  );
}

export async function isRevoked(
  pool: Pool,
  chainId: string,
  partyId: string,
): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM statechain_revocations WHERE chain_id = $1 AND revoked_party_id = $2 LIMIT 1`,
    [chainId, partyId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function issueNonce(pool: Pool, chainId: string): Promise<string> {
  const crypto = await import('crypto');
  const nonce = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO statechain_nonces (chain_id, nonce) VALUES ($1, $2)`,
    [chainId, nonce],
  );
  return nonce;
}

export async function consumeNonce(pool: Pool, nonce: string): Promise<string | null> {
  const r = await pool.query<{ chain_id: string }>(
    `DELETE FROM statechain_nonces WHERE nonce = $1 AND expires_at > NOW() RETURNING chain_id`,
    [nonce],
  );
  return r.rows[0]?.chain_id ?? null;
}

/** Non-destructive nonce check (the authoritative consume is in the transaction). */
export async function nonceExists(pool: Pool, chainId: string, nonce: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM statechain_nonces WHERE nonce = $1 AND chain_id = $2 AND expires_at > NOW() LIMIT 1`,
    [nonce, chainId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function logSignEvent(
  pool: Pool,
  chainId: string,
  eventType: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO statechain_sign_log (chain_id, event_type) VALUES ($1, $2)`,
    [chainId, eventType],
  );
}

export async function getApproachingTimelockChains(pool: Pool): Promise<StatechainRecord[]> {
  const r = await pool.query<StatechainRecord>(
    `SELECT * FROM statechain_records
     WHERE status = 'disputed' AND updated_at < NOW() - INTERVAL '7 days'`,
  );
  return r.rows;
}

/** Run a callback inside one transaction on a dedicated connection. */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export type RevokeOwnerResult =
  | { ok: true; newVersion: number; transferCount: number }
  | { ok: false; reason: 'invalid-nonce' | 'chain-not-found' | 'not-active' | 'stale-owner' };

/**
 * AUD-027: perform nonce consumption, the ownership transition, the revocation
 * insert and the sign-log write in ONE transaction, guarded by a row lock and a
 * version CAS. A request authorized against a stale owner snapshot fails with
 * `stale-owner` instead of overwriting a newer ownership state.
 */
export async function revokeOwnerTransactional(
  pool: Pool,
  params: {
    chainId: string;
    nonce: string;
    expectedOwnerPkd: string;
    revokedPartyId: string;
    newOwnerPartyId: string;
    newOwnerPkd: string;
    newReclaimTxHexEnc: string;
  },
): Promise<RevokeOwnerResult> {
  return withTransaction(pool, async (client) => {
    const nonceRes = await client.query<{ chain_id: string }>(
      `DELETE FROM statechain_nonces WHERE nonce = $1 AND expires_at > NOW() RETURNING chain_id`,
      [params.nonce],
    );
    if (nonceRes.rows[0]?.chain_id !== params.chainId) return { ok: false, reason: 'invalid-nonce' };

    const cur = await client.query<StatechainRecord>(
      `SELECT status, current_owner_pkd, version FROM statechain_records WHERE chain_id = $1 FOR UPDATE`,
      [params.chainId],
    );
    if (cur.rowCount === 0) return { ok: false, reason: 'chain-not-found' };
    const row = cur.rows[0];
    if (row.status !== 'active') return { ok: false, reason: 'not-active' };
    if (row.current_owner_pkd !== params.expectedOwnerPkd) return { ok: false, reason: 'stale-owner' };

    const upd = await client.query<{ version: number; transfer_count: number }>(
      `UPDATE statechain_records
       SET current_owner_party_id = $2,
           current_owner_pkd      = $3,
           reclaim_tx_hex_enc     = $4,
           transfer_count         = transfer_count + 1,
           version                = version + 1,
           updated_at             = NOW()
       WHERE chain_id = $1 AND version = $5 AND status = 'active'
       RETURNING version, transfer_count`,
      [params.chainId, params.newOwnerPartyId, params.newOwnerPkd, params.newReclaimTxHexEnc, row.version],
    );
    if (upd.rowCount === 0) return { ok: false, reason: 'stale-owner' };

    await client.query(
      `INSERT INTO statechain_revocations (chain_id, revoked_party_id, revoked_pkd) VALUES ($1, $2, $3)`,
      [params.chainId, params.revokedPartyId, params.expectedOwnerPkd],
    );
    await client.query(
      `INSERT INTO statechain_sign_log (chain_id, event_type) VALUES ($1, $2)`,
      [params.chainId, 'revoke_key'],
    );

    return { ok: true, newVersion: upd.rows[0].version, transferCount: upd.rows[0].transfer_count };
  });
}

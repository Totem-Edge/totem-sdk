import { Pool } from 'pg';

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
      status                  TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','claimed','disputed')),
      reclaim_tx_hex_enc      TEXT NOT NULL,
      created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
    )
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
  status: 'active' | 'claimed' | 'disputed';
  reclaim_tx_hex_enc: string;
  created_at: Date;
  updated_at: Date;
}

export async function insertStatechainRecord(
  pool: Pool,
  rec: Omit<StatechainRecord, 'transfer_count' | 'status' | 'created_at' | 'updated_at'>,
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

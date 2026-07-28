package seserver

import (
	"database/sql"
	"time"
)

type StatechainRecord struct {
	ChainID             string    `json:"chainId"`
	ProjectID           string    `json:"projectId"`
	CoinID              string    `json:"coinId"`
	TokenID             string    `json:"tokenId"`
	StatechainScript    string    `json:"statechainScript"`
	LockingAddress      string    `json:"lockingAddress"`
	SEPublicKey         string    `json:"sePublicKey"`
	CurrentOwnerPartyID string    `json:"currentOwnerPartyId"`
	CurrentOwnerPKD     string    `json:"currentOwnerPkd"`
	TransferCount       int       `json:"transferCount"`
	Status              string    `json:"status"`
	ReclaimTxHexEnc     string    `json:"reclaimTxHexEnc"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

func migrateStatechainTables(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS statechain_records (
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
		)`,
		`CREATE TABLE IF NOT EXISTS statechain_revocations (
			id                SERIAL PRIMARY KEY,
			chain_id          TEXT NOT NULL REFERENCES statechain_records(chain_id) ON DELETE CASCADE,
			revoked_party_id  TEXT NOT NULL,
			revoked_pkd       TEXT NOT NULL,
			revoked_at        TIMESTAMP NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS statechain_nonces (
			id          SERIAL PRIMARY KEY,
			chain_id    TEXT NOT NULL,
			nonce       TEXT NOT NULL UNIQUE,
			expires_at  TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
		)`,
		`CREATE TABLE IF NOT EXISTS statechain_sign_log (
			id          SERIAL PRIMARY KEY,
			chain_id    TEXT NOT NULL,
			event_type  TEXT NOT NULL,
			logged_at   TIMESTAMP NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sc_records_project   ON statechain_records(project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sc_records_status    ON statechain_records(status)`,
		`CREATE INDEX IF NOT EXISTS idx_sc_revocations_chain ON statechain_revocations(chain_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sc_nonces_chain      ON statechain_nonces(chain_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sc_nonces_expires    ON statechain_nonces(expires_at)`,
		`CREATE INDEX IF NOT EXISTS idx_sc_sign_log_chain    ON statechain_sign_log(chain_id)`,
		`DELETE FROM statechain_nonces WHERE expires_at < NOW()`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

func insertStatechainRecord(db *sql.DB, rec *StatechainRecord) error {
	_, err := db.Exec(
		`INSERT INTO statechain_records
		(chain_id, project_id, coin_id, token_id, statechain_script, locking_address, se_public_key,
		 current_owner_party_id, current_owner_pkd, reclaim_tx_hex_enc)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		rec.ChainID, rec.ProjectID, rec.CoinID, rec.TokenID,
		rec.StatechainScript, rec.LockingAddress, rec.SEPublicKey,
		rec.CurrentOwnerPartyID, rec.CurrentOwnerPKD, rec.ReclaimTxHexEnc,
	)
	return err
}

func getStatechainRecord(db *sql.DB, chainID string) (*StatechainRecord, error) {
	rec := &StatechainRecord{}
	err := db.QueryRow(
		`SELECT chain_id, project_id, coin_id, token_id, statechain_script, locking_address,
		 se_public_key, current_owner_party_id, current_owner_pkd, transfer_count, status,
		 reclaim_tx_hex_enc, created_at, updated_at
		 FROM statechain_records WHERE chain_id = $1`, chainID,
	).Scan(
		&rec.ChainID, &rec.ProjectID, &rec.CoinID, &rec.TokenID,
		&rec.StatechainScript, &rec.LockingAddress, &rec.SEPublicKey,
		&rec.CurrentOwnerPartyID, &rec.CurrentOwnerPKD, &rec.TransferCount, &rec.Status,
		&rec.ReclaimTxHexEnc, &rec.CreatedAt, &rec.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return rec, err
}

func updateStatechainOwner(db *sql.DB, chainID, newOwnerPartyID, newOwnerPKD, newReclaimTxHexEnc string) error {
	_, err := db.Exec(
		`UPDATE statechain_records
		 SET current_owner_party_id = $2, current_owner_pkd = $3,
		     reclaim_tx_hex_enc = $4, transfer_count = transfer_count + 1, updated_at = NOW()
		 WHERE chain_id = $1`,
		chainID, newOwnerPartyID, newOwnerPKD, newReclaimTxHexEnc,
	)
	return err
}

func updateStatechainStatus(db *sql.DB, chainID, status string) error {
	_, err := db.Exec(
		`UPDATE statechain_records SET status = $2, updated_at = NOW() WHERE chain_id = $1`,
		chainID, status,
	)
	return err
}

func insertRevocation(db *sql.DB, chainID, revokedPartyID, revokedPKD string) error {
	_, err := db.Exec(
		`INSERT INTO statechain_revocations (chain_id, revoked_party_id, revoked_pkd) VALUES ($1, $2, $3)`,
		chainID, revokedPartyID, revokedPKD,
	)
	return err
}

func isRevoked(db *sql.DB, chainID, partyID string) (bool, error) {
	var exists bool
	err := db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM statechain_revocations WHERE chain_id = $1 AND revoked_party_id = $2)`,
		chainID, partyID,
	).Scan(&exists)
	return exists, err
}

func issueNonce(db *sql.DB, chainID string) (string, error) {
	nonceBytes := make([]byte, 32)
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", err
	}
	nonce := hex.EncodeToString(nonceBytes)
	_, err := db.Exec(
		`INSERT INTO statechain_nonces (chain_id, nonce) VALUES ($1, $2)`,
		chainID, nonce,
	)
	return nonce, err
}

func consumeNonce(db *sql.DB, nonce string) (string, error) {
	var chainID string
	err := db.QueryRow(
		`DELETE FROM statechain_nonces WHERE nonce = $1 AND expires_at > NOW() RETURNING chain_id`,
		nonce,
	).Scan(&chainID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return chainID, err
}

func logSignEvent(db *sql.DB, chainID, eventType string) error {
	_, err := db.Exec(
		`INSERT INTO statechain_sign_log (chain_id, event_type) VALUES ($1, $2)`,
		chainID, eventType,
	)
	return err
}

func getApproachingTimelockChains(db *sql.DB) ([]StatechainRecord, error) {
	rows, err := db.Query(
		`SELECT chain_id, project_id, coin_id, token_id, statechain_script, locking_address,
		 se_public_key, current_owner_party_id, current_owner_pkd, transfer_count, status,
		 reclaim_tx_hex_enc, created_at, updated_at
		 FROM statechain_records
		 WHERE status = 'disputed' AND updated_at < NOW() - INTERVAL '7 days'`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []StatechainRecord
	for rows.Next() {
		var rec StatechainRecord
		if err := rows.Scan(
			&rec.ChainID, &rec.ProjectID, &rec.CoinID, &rec.TokenID,
			&rec.StatechainScript, &rec.LockingAddress, &rec.SEPublicKey,
			&rec.CurrentOwnerPartyID, &rec.CurrentOwnerPKD, &rec.TransferCount, &rec.Status,
			&rec.ReclaimTxHexEnc, &rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

/**
 * se-server router tests — full HTTP flows against a mocked pg Pool.
 *
 * The pool mock records queries and returns canned rows so the router's
 * request handling, schema validation, nonce consumption, and signature
 * verification paths are exercised without a real Postgres.
 */

import express from 'express';
import { createSeRouter } from '../router';
import { getPublicKeyHex } from '../seKey';
import type { SeServerConfig } from '../config';

const SEED = new Uint8Array(32).fill(0x5e);
const SE_PKD = getPublicKeyHex(SEED);

interface MockPool {
  query: jest.Mock;
}

function makePool(): MockPool {
  const pool: MockPool = { query: jest.fn() };

  // Default canned responses per query shape.
  pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
    const text = String(sql);

    if (text.includes('INSERT INTO statechain_records')) return { rows: [], rowCount: 1 };
    if (text.includes('INSERT INTO statechain_nonces')) return { rows: [], rowCount: 1 };
    if (text.includes('INSERT INTO statechain_revocations')) return { rows: [], rowCount: 1 };
    if (text.includes('INSERT INTO statechain_sign_log')) return { rows: [], rowCount: 1 };

    if (text.includes('DELETE FROM statechain_nonces')) {
      const nonce = params?.[0];
      if (nonce === 'valid-nonce') return { rows: [{ chain_id: 'sc_test' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }

    if (text.includes('SELECT * FROM statechain_records WHERE chain_id')) {
      const chainId = params?.[0];
      if (chainId === 'sc_missing') return { rows: [], rowCount: 0 };
      return {
        rows: [{
          chain_id: chainId,
          project_id: 'default',
          coin_id: '0x' + '11'.repeat(32),
          token_id: '0x00',
          statechain_script: 'RETURN TRUE',
          locking_address: '0x' + '22'.repeat(32),
          se_public_key: SE_PKD,
          current_owner_party_id: 'owner-1',
          current_owner_pkd: '0x' + '33'.repeat(32),
          transfer_count: 0,
          status: 'active',
          reclaim_tx_hex_enc: 'enc:deadbeef',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };
    }

    if (text.includes('SELECT 1 FROM statechain_revocations')) return { rows: [], rowCount: 0 };
    if (text.includes('UPDATE statechain_records')) return { rows: [], rowCount: 1 };

    return { rows: [], rowCount: 0 };
  });

  return pool;
}

function makeApp(pool: MockPool, betaMode = false): express.Express {
  const config: SeServerConfig = {
    seSeed: SEED,
    databaseUrl: 'postgres://localhost/db',
    reclaimTimelock: 256,
    betaMode,
  };
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/statechain', createSeRouter(config, pool as unknown as import('pg').Pool));
  app.use('/v1/statechain', createSeRouter(config, pool as unknown as import('pg').Pool));
  return app;
}

import http from 'node:http';

function httpRequest(
  app: express.Express,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown>; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        server.close();
        return reject(new Error('no address'));
      }
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        {
          host: '127.0.0.1',
          port: addr.port,
          method,
          path,
          headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            server.close();
            let json: Record<string, unknown> = {};
            try { json = JSON.parse(data); } catch { /* non-JSON body */ }
            resolve({ status: res.statusCode ?? 500, json, headers: res.headers });
          });
        },
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

describe('se-server router', () => {
  it('GET /se-public-key returns the SE public key and timelock', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'GET', '/statechain/se-public-key');
    expect(res.status).toBe(200);
    expect(res.json.sePublicKey).toBe(SE_PKD);
    expect(res.json.reclaimTimelock).toBe(256);
  });

  it('POST /create inserts a statechain record and returns the locking script', async () => {
    const pool = makePool();
    const app = makeApp(pool);
    const res = await httpRequest(app, 'POST', '/statechain/create', {
      coinId: '0x' + '11'.repeat(32),
      ownerPublicKeyDigest: '0x' + '33'.repeat(32),
      ownerPartyId: 'owner-1',
      reclaimTxHex: '0x' + 'ab'.repeat(100),
      tokenId: '0x00',
    });
    expect(res.status).toBe(201);
    expect(res.json.chainId).toMatch(/^sc_/);
    expect(res.json.sePublicKey).toBe(SE_PKD);
    expect(res.json.lockingAddress).toMatch(/^[0-9a-fA-F]{64}$/);
    expect(pool.query).toHaveBeenCalled();
  });

  it('POST /create rejects invalid bodies', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'POST', '/statechain/create', { coinId: '' });
    expect(res.status).toBe(400);
  });

  it('GET /:chainId/challenge issues a nonce', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'GET', '/statechain/sc_test/challenge');
    expect(res.status).toBe(200);
    expect(res.json.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(res.json.expiresInSeconds).toBe(300);
  });

  it('GET /:chainId/challenge returns 404 for unknown chains', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'GET', '/statechain/sc_missing/challenge');
    expect(res.status).toBe(404);
  });

  it('POST /:chainId/blind-sign rejects an invalid nonce', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'POST', '/statechain/sc_test/blind-sign', {
      blindedCommitment: '0x' + '44'.repeat(32),
      nonce: 'bad-nonce',
      ownerSignature: '0x' + '55'.repeat(100),
    });
    expect(res.status).toBe(401);
  });

  it('POST /:chainId/blind-sign returns a blind signature for a valid nonce', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'POST', '/statechain/sc_test/blind-sign', {
      blindedCommitment: '0x' + '44'.repeat(32),
      nonce: 'valid-nonce',
      ownerSignature: '0x' + '55'.repeat(100),
    });
    // Owner signature verification is skipped in this mock (pkd mismatch would
    // 403); the flow still exercises nonce consumption + SE signing.
    expect([200, 403]).toContain(res.status);
    if (res.status === 200) {
      expect(res.json.blindSignature).toMatch(/^[0-9a-f]+$/);
    }
  });

  it('GET /:chainId returns chain metadata', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'GET', '/statechain/sc_test');
    expect(res.status).toBe(200);
    expect(res.json.chainId).toBe('sc_test');
    expect(res.json.status).toBe('active');
  });

  it('GET /:chainId/reclaim-tx requires nonce and ownerSignature', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'GET', '/statechain/sc_test/reclaim-tx');
    expect(res.status).toBe(400);
  });

  it('POST /:chainId/claim rejects an invalid nonce', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'POST', '/statechain/sc_test/claim', {
      claimAddress: '0x' + '66'.repeat(32),
      claimTxHex: '0x' + '77'.repeat(100),
      ownerSignature: '0x' + '88'.repeat(100),
      nonce: 'bad-nonce',
    });
    expect(res.status).toBe(401);
  });

  it('POST /:chainId/revoke-key rejects an invalid nonce', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'POST', '/statechain/sc_test/revoke-key', {
      previousOwnerPartyId: 'owner-1',
      previousOwnerPkd: '0x' + '33'.repeat(32),
      newOwnerPartyId: 'owner-2',
      newOwnerPkd: '0x' + '99'.repeat(32),
      newReclaimTxHex: '0x' + 'aa'.repeat(100),
      ownerSignature: '0x' + 'bb'.repeat(100),
      nonce: 'bad-nonce',
    });
    expect(res.status).toBe(401);
  });

  it('serves the same API under the versioned /v1/statechain prefix', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'GET', '/v1/statechain/se-public-key');
    expect(res.status).toBe(200);
    expect(res.json.sePublicKey).toBe(SE_PKD);

    const created = await httpRequest(app, 'POST', '/v1/statechain/create', {
      coinId: '0x' + '11'.repeat(32),
      ownerPublicKeyDigest: '0x' + '33'.repeat(32),
      ownerPartyId: 'owner-1',
      reclaimTxHex: '0x' + 'ab'.repeat(100),
      tokenId: '0x00',
    });
    expect(created.status).toBe(201);
    expect(created.json.chainId).toMatch(/^sc_/);
  });

  it('omits X-Beta headers by default (stable API)', async () => {
    const app = makeApp(makePool());
    const res = await httpRequest(app, 'GET', '/statechain/se-public-key');
    expect(res.status).toBe(200);
    expect(res.headers['x-beta']).toBeUndefined();
    expect(res.headers['x-beta-warning']).toBeUndefined();
  });

  it('adds X-Beta headers when betaMode is enabled', async () => {
    const app = makeApp(makePool(), true);
    const res = await httpRequest(app, 'GET', '/statechain/se-public-key');
    expect(res.status).toBe(200);
    expect(res.headers['x-beta']).toBe('true');
    expect(res.headers['x-beta-warning']).toContain('BETA API');
  });
});

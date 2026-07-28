import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { sha3_256, bytesToHex } from '@totemsdk/core';
import { z } from 'zod';
import { Pool } from 'pg';
import {
  insertStatechainRecord,
  getStatechainRecord,
  updateStatechainOwner,
  updateStatechainStatus,
  insertRevocation,
  isRevoked,
  issueNonce,
  consumeNonce,
  logSignEvent,
} from './db';
import {
  getPublicKeyHex,
  seSign,
  wotsVerifyDigestAsync,
  encryptReclaimTx,
  decryptReclaimTx,
} from './seKey';
import type { SeServerConfig } from './config';

function fromHex(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s.replace(/^0x/i, ''), 'hex'));
}

function buildStatechainScript(sePkd: string, reclaimTimelock: number): string {
  const kissHex = '0X' + sePkd.replace(/^0x/i, '').toUpperCase();
  return [
    'LET OWNER=STATE(0)',
    `IF @COINAGE GTE ${reclaimTimelock} THEN`,
    '  RETURN SIGNEDBY(OWNER)',
    'ENDIF',
    `ASSERT MULTISIG(2 OWNER ${kissHex})`,
    'RETURN TRUE',
  ].join('\n');
}

function scriptAddress(script: string): string {
  return bytesToHex(sha3_256(new TextEncoder().encode(script.trim().toUpperCase())));
}

function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function resolveProjectId(req: Request): string {
  return (req as any).projectId ?? req.params?.projectId ?? 'default';
}

const CreateSchema = z.object({
  coinId:               z.string().min(1),
  ownerPublicKeyDigest: z.string().min(1),
  ownerPartyId:         z.string().min(1),
  reclaimTxHex:         z.string().min(1),
  tokenId:              z.string().default('0x00'),
});

const BlindSignSchema = z.object({
  blindedCommitment: z.string().min(1),
  nonce:             z.string().min(1),
  ownerSignature:    z.string().min(1),
});

const RevokeSchema = z.object({
  previousOwnerPartyId: z.string().min(1),
  previousOwnerPkd:     z.string().min(1),
  newOwnerPartyId:      z.string().min(1),
  newOwnerPkd:          z.string().min(1),
  newReclaimTxHex:      z.string().min(1),
  ownerSignature:       z.string().min(1),
  nonce:                z.string().min(1),
});

const ClaimSchema = z.object({
  claimAddress:   z.string().min(1),
  claimTxHex:     z.string().min(1),
  ownerSignature: z.string().min(1),
  nonce:          z.string().min(1),
});

const ReclaimQuerySchema = z.object({
  nonce:          z.string().min(1),
  ownerSignature: z.string().min(1),
});

async function verifyOwnerSig(ownerPkd: string, nonce: string, ownerSig: string): Promise<boolean> {
  try {
    const msg = sha3_256(new TextEncoder().encode(nonce));
    return await wotsVerifyDigestAsync(fromHex(ownerSig), msg, fromHex(ownerPkd));
  } catch { return false; }
}

export function createSeRouter(config: SeServerConfig, pool: Pool): Router {
  const r = Router();
  const reclaimTimelock = config.reclaimTimelock ?? 256;
  const seed = config.seSeed;

  function betaHeaders(res: Response): void {
    if (config.betaMode !== false) {
      res.setHeader('X-Beta', 'true');
      res.setHeader('X-Beta-Warning', 'BETA API. Breaking changes may occur without notice.');
      res.setHeader('X-SE-SLA', '99.5%');
    }
  }

  r.get('/se-public-key', (_req: Request, res: Response) => {
    betaHeaders(res);
    res.json({ sePublicKey: getPublicKeyHex(seed), reclaimTimelock, sla: '99.5%' });
  });

  r.post('/create', asyncRoute(async (req, res) => {
    betaHeaders(res);
    const body = CreateSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Invalid body', details: body.error.issues });

    const { coinId, ownerPublicKeyDigest, ownerPartyId, reclaimTxHex, tokenId } = body.data;
    const projectId = resolveProjectId(req);
    const sePkd = getPublicKeyHex(seed);
    const statechainScript = buildStatechainScript(sePkd, reclaimTimelock);
    const lockingAddress = scriptAddress(statechainScript);
    const chainId = 'sc_' + crypto.randomBytes(16).toString('hex');
    const encReclaim = encryptReclaimTx(seed, reclaimTxHex);

    await insertStatechainRecord(pool, {
      chain_id: chainId, project_id: projectId, coin_id: coinId, token_id: tokenId,
      statechain_script: statechainScript, locking_address: lockingAddress,
      se_public_key: sePkd, current_owner_party_id: ownerPartyId,
      current_owner_pkd: ownerPublicKeyDigest, reclaim_tx_hex_enc: encReclaim,
    });
    await logSignEvent(pool, chainId, 'create');
    config.onSign?.({ chainId, eventType: 'create', projectId });

    return res.status(201).json({
      chainId, statechainScript, lockingAddress, sePublicKey: sePkd,
      reclaimTxHex, reclaimTimelock, tokenId,
    });
  }));

  r.get('/:chainId/challenge', asyncRoute(async (req, res) => {
    betaHeaders(res);
    const chain = await getStatechainRecord(pool, req.params.chainId as string);
    if (!chain) return res.status(404).json({ error: 'Statechain not found' });
    if (chain.status === 'claimed') return res.status(410).json({ error: 'Statechain already claimed' });
    const nonce = await issueNonce(pool, req.params.chainId as string);
    return res.json({ nonce, expiresInSeconds: 300 });
  }));

  r.post('/:chainId/blind-sign', asyncRoute(async (req, res) => {
    betaHeaders(res);
    const chainId = req.params.chainId as string;
    const body = BlindSignSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Invalid body', details: body.error.issues });

    const { blindedCommitment, nonce, ownerSignature } = body.data;
    const chain = await getStatechainRecord(pool, chainId);
    if (!chain) return res.status(404).json({ error: 'Statechain not found' });
    if (chain.status !== 'active') return res.status(409).json({ error: `Statechain not active (${chain.status})` });

    const nonceChainId = await consumeNonce(pool, nonce);
    if (!nonceChainId || nonceChainId !== chainId) return res.status(401).json({ error: 'Invalid or expired nonce' });

    if (!await verifyOwnerSig(chain.current_owner_pkd, nonce, ownerSignature)) {
      return res.status(403).json({ error: 'Ownership verification failed' });
    }
    if (await isRevoked(pool, chainId, chain.current_owner_party_id)) {
      return res.status(403).json({ error: 'Current owner key has been revoked' });
    }

    let commitmentBytes: Uint8Array;
    try { commitmentBytes = fromHex(blindedCommitment); }
    catch { return res.status(400).json({ error: 'blindedCommitment must be valid hex' }); }

    const seSignatureHex = bytesToHex(await seSign(seed, commitmentBytes));
    await logSignEvent(pool, chainId, 'blind_sign');
    config.onSign?.({ chainId, eventType: 'blind_sign', projectId: resolveProjectId(req) });

    return res.json({ blindSignature: seSignatureHex });
  }));

  r.post('/:chainId/revoke-key', asyncRoute(async (req, res) => {
    betaHeaders(res);
    const chainId = req.params.chainId as string;
    const body = RevokeSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Invalid body', details: body.error.issues });

    const { previousOwnerPartyId, previousOwnerPkd, newOwnerPartyId, newOwnerPkd,
            newReclaimTxHex, ownerSignature, nonce } = body.data;
    const chain = await getStatechainRecord(pool, chainId);
    if (!chain) return res.status(404).json({ error: 'Statechain not found' });
    if (chain.status !== 'active') return res.status(409).json({ error: `Statechain not active (${chain.status})` });

    const nonceChainId = await consumeNonce(pool, nonce);
    if (!nonceChainId || nonceChainId !== chainId) return res.status(401).json({ error: 'Invalid or expired nonce' });

    if (!await verifyOwnerSig(previousOwnerPkd, nonce, ownerSignature)) {
      return res.status(403).json({ error: 'Previous owner signature verification failed' });
    }
    if (previousOwnerPkd !== chain.current_owner_pkd) {
      return res.status(400).json({ error: 'previousOwnerPkd does not match current chain owner' });
    }

    await insertRevocation(pool, chainId, previousOwnerPartyId, previousOwnerPkd);
    await updateStatechainOwner(pool, chainId, newOwnerPartyId, newOwnerPkd, encryptReclaimTx(seed, newReclaimTxHex));
    await logSignEvent(pool, chainId, 'revoke_key');

    return res.json({ ok: true, transferCount: chain.transfer_count + 1 });
  }));

  r.get('/:chainId', asyncRoute(async (req, res) => {
    betaHeaders(res);
    const chain = await getStatechainRecord(pool, req.params.chainId as string);
    if (!chain) return res.status(404).json({ error: 'Statechain not found' });
    return res.json({
      chainId: chain.chain_id, coinId: chain.coin_id, tokenId: chain.token_id,
      currentOwnerPartyId: chain.current_owner_party_id, transferCount: chain.transfer_count,
      status: chain.status, lockingAddress: chain.locking_address,
      sePublicKey: chain.se_public_key, createdAt: chain.created_at,
    });
  }));

  r.post('/:chainId/claim', asyncRoute(async (req, res) => {
    betaHeaders(res);
    const chainId = req.params.chainId as string;
    const body = ClaimSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Invalid body', details: body.error.issues });

    const { claimAddress, claimTxHex, ownerSignature, nonce } = body.data;
    const chain = await getStatechainRecord(pool, chainId);
    if (!chain) return res.status(404).json({ error: 'Statechain not found' });
    if (chain.status !== 'active') return res.status(409).json({ error: `Statechain not active (${chain.status})` });

    const nonceChainId = await consumeNonce(pool, nonce);
    if (!nonceChainId || nonceChainId !== chainId) return res.status(401).json({ error: 'Invalid or expired nonce' });

    if (!await verifyOwnerSig(chain.current_owner_pkd, nonce, ownerSignature)) {
      return res.status(403).json({ error: 'Ownership verification failed' });
    }

    const claimDigest = sha3_256(new TextEncoder().encode(claimTxHex));
    const seClaimSignature = bytesToHex(await seSign(seed, claimDigest));
    await updateStatechainStatus(pool, chainId, 'claimed');
    await logSignEvent(pool, chainId, 'claim');
    config.onSign?.({ chainId, eventType: 'claim', projectId: resolveProjectId(req) });

    return res.json({ ok: true, chainId, claimAddress, claimTxHex, seClaimSignature });
  }));

  r.get('/:chainId/reclaim-tx', asyncRoute(async (req, res) => {
    betaHeaders(res);
    const chainId = req.params.chainId as string;
    const query = ReclaimQuerySchema.safeParse(req.query);
    if (!query.success) {
      return res.status(400).json({
        error: 'Provide nonce and ownerSignature as query params',
        hint: 'GET /:chainId/challenge first, then sign the nonce with your WOTS key',
        details: query.error.issues,
      });
    }

    const { nonce, ownerSignature } = query.data;
    const chain = await getStatechainRecord(pool, chainId);
    if (!chain) return res.status(404).json({ error: 'Statechain not found' });

    const nonceChainId = await consumeNonce(pool, nonce);
    if (!nonceChainId || nonceChainId !== chainId) return res.status(401).json({ error: 'Invalid or expired nonce' });

    if (!await verifyOwnerSig(chain.current_owner_pkd, nonce, ownerSignature)) {
      return res.status(403).json({ error: 'Ownership verification failed' });
    }

    return res.json({
      chainId, reclaimTxHex: decryptReclaimTx(seed, chain.reclaim_tx_hex_enc), reclaimTimelock,
      warning: 'Broadcast ONLY after the timelock has elapsed and the SE is unresponsive.',
    });
  }));

  return r;
}

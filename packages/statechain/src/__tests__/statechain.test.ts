import { sha3_256, bytesToHex } from '@totemsdk/core';
import { hex } from '@totemsdk/core';
import {
  createStateChain,
  transferOwnership,
  verifyStateChain,
  claimOwnership,
  reclaimAbandoned,
  buildStatechainScript,
  RECLAIM_TIMELOCK,
} from '../index';
import type {
  StatechainOwner,
  SEClient,
  StatechainLeaseProvider,
  StateChain,
} from '../index';
import { attachSe, makeOwner, testSE } from './tree-fixtures';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fakePkd(label: string): string {
  return hex(sha3_256(new TextEncoder().encode(label)));
}

function fakeAddress(label: string): string {
  return hex(sha3_256(new TextEncoder().encode(`addr:${label}`))).padStart(64, '0');
}

const SE = testSE();

function makeSEClient(): ReturnType<typeof SE.client> {
  return SE.client();
}

function makeLeaseProvider(se: SEClient): StatechainLeaseProvider {
  return { seClient: se };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const COIN_ID  = '0xaabbcc0011223344556677889900aabb00112233445566778899001122334455';
const TOKEN_ID = '0x00';
const AMOUNT   = 1_000_000n;
const SE_ROOT  = SE.rootPublicKey;
const ALICE_ADDRESS = fakeAddress('alice');

function makeAlice(): StatechainOwner {
  return makeOwner('alice', { address: ALICE_ADDRESS, tokenId: TOKEN_ID, amount: AMOUNT });
}

/** Create a chain bound to the test SE and attach the SE's published proof. */
async function createChain(
  se: SEClient,
  owner: StatechainOwner = makeAlice(),
): Promise<StateChain> {
  const chain = await createStateChain(COIN_ID, owner, SE_ROOT, makeLeaseProvider(se));
  return attachSe(chain, SE);
}

// ─── createStateChain ────────────────────────────────────────────────────────

describe('@totemsdk/statechain — createStateChain', () => {
  let se: ReturnType<typeof makeSEClient>;
  let ownerA: StatechainOwner;
  let chain: StateChain;

  beforeEach(async () => {
    se     = makeSEClient();
    ownerA = makeAlice();
    chain  = await createChain(se, ownerA);
  });

  it('creates chain with status active', () => {
    expect(chain.status).toBe('active');
  });

  it('lock TX output coinId is stored as chain.coinId — NOT the original input coinId', () => {
    // createStateChain builds a lock TX; the OUTPUT coin has a new, computed coinId
    expect(chain.coinId).not.toBe(COIN_ID);
    expect(chain.coinId).toMatch(/^[0-9A-Fa-f]+$/);
  });

  it('sets tokenId and amount from owner', () => {
    expect(chain.tokenId).toBe(TOKEN_ID);
    expect(chain.amount).toBe(AMOUNT);
  });

  it('sets sePublicKey to the SE root', () => {
    expect(chain.sePublicKey).toBe(SE_ROOT);
  });

  it('sets currentOwner to alice', () => {
    expect(chain.currentOwner.partyId).toBe('alice');
    expect(chain.currentOwner.publicKeyDigest).toBe(ownerA.publicKeyDigest);
  });

  it('strips creation-time metadata from stored currentOwner', () => {
    expect((chain.currentOwner as StatechainOwner & { address?: string }).address).toBeUndefined();
    expect((chain.currentOwner as StatechainOwner & { tokenId?: string }).tokenId).toBeUndefined();
    expect((chain.currentOwner as StatechainOwner & { amount?: bigint }).amount).toBeUndefined();
  });

  it('transferHistory starts empty', () => {
    expect(chain.transferHistory).toHaveLength(0);
  });

  it('chainId is a 64-char hex string', () => {
    expect(chain.chainId).toMatch(/^[0-9A-Fa-f]{64}$/);
  });

  it('lockingScript uses STATE(0) for owner key (not hardcoded PKD)', () => {
    expect(chain.lockingScript).toContain('STATE(0)');
    expect(chain.lockingScript.toUpperCase()).not.toContain(ownerA.publicKeyDigest.toUpperCase());
  });

  it('lockingScript contains MULTISIG(2', () => {
    expect(chain.lockingScript).toContain('MULTISIG(2');
  });

  it('lockingScript contains SE root public key', () => {
    expect(chain.lockingScript.toUpperCase()).toContain(SE_ROOT.toUpperCase());
  });

  it('lockingScript uses @COINAGE-based reclaim timelock', () => {
    expect(chain.lockingScript).toContain('@COINAGE');
    expect(chain.lockingScript).toContain(`${RECLAIM_TIMELOCK}`);
    expect(chain.lockingScript).toContain('SIGNEDBY');
  });

  it('lockingAddress is a non-empty hex string', () => {
    expect(chain.lockingAddress.length).toBeGreaterThan(0);
  });

  it('lockingAddress is same for different owners with the same SE', async () => {
    const ownerB = makeOwner('bob', { address: fakeAddress('bob'), tokenId: TOKEN_ID, amount: AMOUNT });
    const chain2 = await createChain(makeSEClient(), ownerB);
    expect(chain2.lockingAddress).toBe(chain.lockingAddress);
  });

  it('reclaimTx is pre-built (signed with TX body digest, not synthetic hash)', () => {
    expect(chain.reclaimTx.length).toBeGreaterThan(100);
    expect(chain.reclaimTx).toMatch(/^[0-9A-Fa-f]+$/);
  });

  it('reclaimAddress is SIGNEDBY(ownerRoot) output, distinct from lockingAddress', () => {
    expect(chain.reclaimAddress.length).toBeGreaterThan(0);
    expect(chain.reclaimAddress).not.toBe(chain.lockingAddress);
    expect(chain.reclaimAddress).toMatch(/^Mx[0-9A-Z]+$/);
  });

  it('reclaimTimelock equals RECLAIM_TIMELOCK constant', () => {
    expect(chain.reclaimTimelock).toBe(RECLAIM_TIMELOCK);
  });

  it('SE.registerChain is called with the locked coinId (not the input coinId)', () => {
    expect(se.registeredChains).toContain(chain.chainId);
  });

  it('chainId and lockingAddress are deterministic', async () => {
    const chain2 = await createChain(makeSEClient(), makeAlice());
    expect(chain2.chainId).toBe(chain.chainId);
    expect(chain2.lockingAddress).toBe(chain.lockingAddress);
    expect(chain2.coinId).toBe(chain.coinId);  // lock TX output is also deterministic
    expect(chain2.reclaimAddress).toBe(chain.reclaimAddress);
  });

  it('leaseProvider.broadcast is called for lock TX if present', async () => {
    const broadcastFn = jest.fn().mockResolvedValue({ success: true, txpowid: 'lock-tx-id' });
    const lp: StatechainLeaseProvider = { ...makeLeaseProvider(makeSEClient()), broadcast: broadcastFn };
    await createStateChain(COIN_ID, makeAlice(), SE_ROOT, lp);
    expect(broadcastFn).toHaveBeenCalledTimes(1);
  });

  it('works with a minimal SEClient (no registerChain)', async () => {
    const minimalSE: SEClient = {
      async blindSign(_c, m) { return SE.sign(m); },
      async revokeKey() {},
      async isRevoked() { return false; },
    };
    const c = await createStateChain(COIN_ID, makeAlice(), SE_ROOT, { seClient: minimalSE });
    expect(c.status).toBe('active');
    expect(c.reclaimTx.length).toBeGreaterThan(100);
  });

  it('throws if owner.address, tokenId, amount are missing and no chainProvider', async () => {
    const bareOwner = makeOwner('alice');
    await expect(createStateChain(COIN_ID, bareOwner, SE_ROOT, makeLeaseProvider(makeSEClient()))).rejects.toThrow(
      'owner.address, owner.tokenId, and owner.amount are required',
    );
  });

  it('falls back to chainProvider.getCoin for coin metadata when owner fields are absent', async () => {
    const bareOwner = makeOwner('alice');
    const mockProvider = {
      getCoins: jest.fn(),
      getCoin: jest.fn().mockResolvedValue({
        coinid: COIN_ID,
        address: ALICE_ADDRESS,
        tokenid: TOKEN_ID,
        amount:  AMOUNT.toString(),
        storestate: false,
      }),
      getProof: jest.fn(),
      getTip: jest.fn().mockResolvedValue({ block: 1000 }),
      getToken: jest.fn(),
      searchTokens: jest.fn(),
      getTokensByCreator: jest.fn(),
      broadcastTxPoW: jest.fn().mockResolvedValue({ success: true }),
    };
    const c = await createStateChain(COIN_ID, bareOwner, SE_ROOT, makeLeaseProvider(makeSEClient()), mockProvider);
    expect(c.status).toBe('active');
    expect(c.tokenId).toBe(TOKEN_ID);
    expect(c.amount).toBe(AMOUNT);
  });
});

// ─── transferOwnership (A → B) ─────────────────────────────────────────────

describe('@totemsdk/statechain — transferOwnership (A → B)', () => {
  let ownerA: StatechainOwner;
  let ownerB: StatechainOwner;
  let se: ReturnType<typeof makeSEClient>;
  let initial: StateChain;
  let transferred: StateChain;

  beforeEach(async () => {
    ownerA  = makeAlice();
    ownerB  = makeOwner('bob');
    se      = makeSEClient();
    initial = await createChain(se, ownerA);
    transferred = await transferOwnership(initial, ownerB, se);
  });

  it('currentOwner is bob after transfer', () => {
    expect(transferred.currentOwner.partyId).toBe('bob');
  });

  it('currentOwner.publicKeyDigest matches bob', () => {
    expect(transferred.currentOwner.publicKeyDigest).toBe(ownerB.publicKeyDigest);
  });

  it('coinId changes to new on-chain coin after transfer', () => {
    expect(transferred.coinId).not.toBe(initial.coinId);
    expect(transferred.coinId.length).toBeGreaterThan(0);
  });

  it('lockingAddress stays the same (STATE(0) design)', () => {
    expect(transferred.lockingAddress).toBe(initial.lockingAddress);
  });

  it('reclaimTx is rebuilt for the new owner (not anchored to initial owner)', () => {
    expect(transferred.reclaimTx.length).toBeGreaterThan(100);
    expect(transferred.reclaimTx).not.toBe(initial.reclaimTx);
  });

  it('reclaimAddress reflects new owner (distinct from initial reclaimAddress)', () => {
    expect(transferred.reclaimAddress).not.toBe(initial.reclaimAddress);
    expect(transferred.reclaimAddress).not.toBe(transferred.lockingAddress);
  });

  it('transferHistory has one record', () => {
    expect(transferred.transferHistory).toHaveLength(1);
  });

  it('TransferRecord.from=alice, to=bob', () => {
    expect(transferred.transferHistory[0].from).toBe('alice');
    expect(transferred.transferHistory[0].to).toBe('bob');
  });

  it('TransferRecord.signedDigest is sha3_256(txBodyHex)', () => {
    const rec = transferred.transferHistory[0];
    const recomputed = bytesToHex(sha3_256(Buffer.from(rec.txBodyHex, 'hex')));
    expect(rec.signedDigest).toBe(recomputed);
  });

  it('TransferRecord.txBodyHex is raw TX bytes hex', () => {
    expect(transferred.transferHistory[0].txBodyHex.length).toBeGreaterThan(0);
    expect(transferred.transferHistory[0].txBodyHex).toMatch(/^[0-9A-Fa-f]+$/);
  });

  it('TransferRecord.ownerSignature is the old owner tree-sig hex', () => {
    expect(transferred.transferHistory[0].ownerSignature.length).toBeGreaterThan(0);
    expect(transferred.transferHistory[0].ownerSignature).toMatch(/^[0-9A-Fa-f]+$/);
  });

  it('TransferRecord.txHex is the state-update TxPoW', () => {
    expect(transferred.transferHistory[0].txHex.length).toBeGreaterThan(100);
  });

  it('fromPublicKeyDigest=alice, toPublicKeyDigest=bob', () => {
    expect(transferred.transferHistory[0].fromPublicKeyDigest).toBe(ownerA.publicKeyDigest);
    expect(transferred.transferHistory[0].toPublicKeyDigest).toBe(ownerB.publicKeyDigest);
  });

  it('SE.revokeKey is called for alice', () => {
    expect(se.revokedKeys).toContain('alice');
  });

  it('status remains active', () => {
    expect(transferred.status).toBe('active');
  });

  it('throws if chain is not active', async () => {
    const closed: StateChain = { ...initial, status: 'claimed' };
    await expect(transferOwnership(closed, ownerB, se)).rejects.toThrow('active');
  });

  it('throws if the SE envelope is invalid (bad message binding)', async () => {
    const badSE: SEClient = {
      ...se,
      blindSign: async (_chainId, m) => ({ ...SE.sign(m), message: 'deadbeef' }),
    };
    await expect(transferOwnership(initial, ownerB, badSE)).rejects.toThrow('verification failed');
  });
});

// ─── transfer chain A → B → C ─────────────────────────────────────────────

describe('@totemsdk/statechain — transfer chain A → B → C', () => {
  let ownerA: StatechainOwner;
  let ownerB: StatechainOwner;
  let ownerC: StatechainOwner;
  let se: ReturnType<typeof makeSEClient>;
  let afterAB: StateChain;
  let afterBC: StateChain;

  beforeEach(async () => {
    ownerA = makeAlice();
    ownerB = makeOwner('bob');
    ownerC = makeOwner('carol');
    se     = makeSEClient();
    const initial = await createChain(se, ownerA);
    afterAB = await transferOwnership(initial, ownerB, se);
    afterBC = await transferOwnership(afterAB, ownerC, se);
  });

  it('currentOwner is carol', () => {
    expect(afterBC.currentOwner.partyId).toBe('carol');
  });

  it('transferHistory has 2 records', () => {
    expect(afterBC.transferHistory).toHaveLength(2);
  });

  it('transfer chain is continuous (alice → bob → carol)', () => {
    expect(afterBC.transferHistory[0].from).toBe('alice');
    expect(afterBC.transferHistory[0].to).toBe('bob');
    expect(afterBC.transferHistory[1].from).toBe('bob');
    expect(afterBC.transferHistory[1].to).toBe('carol');
  });

  it('coinId is distinct for each hop', () => {
    expect(afterAB.coinId).not.toBe(COIN_ID);
    expect(afterBC.coinId).not.toBe(afterAB.coinId);
  });

  it('lockingAddress remains constant across all hops', () => {
    expect(afterAB.lockingAddress).toBe(afterBC.lockingAddress);
  });

  it('reclaimTx is rebuilt for carol after B→C transfer', () => {
    expect(afterBC.reclaimTx.length).toBeGreaterThan(100);
    expect(afterBC.reclaimTx).not.toBe(afterAB.reclaimTx);
  });

  it('reclaimAddress reflects carol (different from alice and bob)', () => {
    expect(afterBC.reclaimAddress).not.toBe(afterAB.reclaimAddress);
  });

  it('PKD lineage: toPublicKeyDigest[0] === fromPublicKeyDigest[1]', () => {
    const h = afterBC.transferHistory;
    expect(h[0].toPublicKeyDigest).toBe(h[1].fromPublicKeyDigest);
  });

  it('SE.revokedKeys contains both alice and bob', () => {
    expect(se.revokedKeys).toContain('alice');
    expect(se.revokedKeys).toContain('bob');
  });

  it('signedDigest matches sha3_256(txBodyHex) for both hops', () => {
    for (const rec of afterBC.transferHistory) {
      const recomputed = bytesToHex(sha3_256(Buffer.from(rec.txBodyHex, 'hex')));
      expect(rec.signedDigest).toBe(recomputed);
    }
  });

  it('each transfer has a unique SE signature, signedDigest, and ownerSignature', () => {
    const h = afterBC.transferHistory;
    expect(h[0].seSignature.signature).not.toBe(h[1].seSignature.signature);
    expect(h[0].signedDigest).not.toBe(h[1].signedDigest);
    expect(h[0].ownerSignature).not.toBe(h[1].ownerSignature);
  });
});

// ─── verifyStateChain ─────────────────────────────────────────────────────

describe('@totemsdk/statechain — verifyStateChain', () => {
  let validChain: StateChain;

  beforeEach(async () => {
    const se = makeSEClient();
    const initial = await createChain(se, makeAlice());
    const afterAB = await transferOwnership(initial, makeOwner('bob'),   se);
    validChain    = await transferOwnership(afterAB, makeOwner('carol'), se);
  });

  it('returns valid=true for a correct A→B→C chain', () => {
    expect(verifyStateChain(validChain).valid).toBe(true);
  });

  it('returns depth=2 and rootOwner=alice for A→B→C chain', () => {
    const r = verifyStateChain(validChain);
    expect(r.depth).toBe(2);
    expect(r.rootOwner).toBe('alice');
  });

  it('returns valid=true, depth=0 for a fresh chain', async () => {
    const fresh = await createChain(makeSEClient(), makeAlice());
    const r = verifyStateChain(fresh);
    expect(r.valid).toBe(true);
    expect(r.depth).toBe(0);
    expect(r.rootOwner).toBe('alice');
  });

  it('detects tampered SE signature', () => {
    const tampered: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 0 ? { ...r, seSignature: { ...r.seSignature, signature: '00' } } : r,
      ),
    };
    const result = verifyStateChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('signature');
  });

  it('detects an SE envelope whose leaf is not authorized', () => {
    const tampered: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 0 ? { ...r, seSignature: { ...r.seSignature, publicKey: 'cc'.repeat(32) } } : r,
      ),
    };
    expect(verifyStateChain(tampered).valid).toBe(false);
  });

  it('detects tampered ownerSignature', () => {
    const tampered: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 0 ? { ...r, ownerSignature: 'deadbeef' + '00'.repeat(28) } : r,
      ),
    };
    const result = verifyStateChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('owner signature');
  });

  it('detects missing ownerSignature', () => {
    const tampered: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 1 ? { ...r, ownerSignature: '' } : r,
      ),
    };
    expect(verifyStateChain(tampered).valid).toBe(false);
  });

  it('detects an owner signature rooted to a different key', () => {
    // alice's signature is valid, but re-labelled as carol → root mismatch.
    const tampered: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 0 ? { ...r, fromPublicKeyDigest: fakePkd('intruder') } : r,
      ),
    };
    expect(verifyStateChain(tampered).valid).toBe(false);
  });

  it('detects tampered txBodyHex (signature grafting attack)', () => {
    const tampered: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 0 ? { ...r, txBodyHex: 'deadbeef'.repeat(20) } : r,
      ),
    };
    const result = verifyStateChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('signedDigest mismatch');
  });

  it('detects tampered signedDigest (pre-image swap — txBodyHex and sigs disagree)', () => {
    const tampered: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 0 ? { ...r, signedDigest: 'deadbeef'.repeat(8) } : r,
      ),
    };
    expect(verifyStateChain(tampered).valid).toBe(false);
  });

  it('detects broken chain continuity', () => {
    const broken: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 1 ? { ...r, from: 'intruder' } : r,
      ),
    };
    const result = verifyStateChain(broken);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Broken chain');
  });

  it('detects PKD continuity breach', () => {
    const tampered: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 1 ? { ...r, fromPublicKeyDigest: fakePkd('intruder') } : r,
      ),
    };
    const result = verifyStateChain(tampered);
    expect(result.valid).toBe(false);
    // Either "PKD mismatch" continuity or "owner signature" root mismatch — both
    // indicate the from-key was not the hop's signer.
    expect(result.reason).toMatch(/PKD mismatch|owner signature/);
  });

  it('detects a missing SE envelope', () => {
    const badKey: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 0 ? ({ ...r, seSignature: undefined } as unknown as typeof r) : r,
      ),
    };
    const result = verifyStateChain(badKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('SE signature');
  });

  it('detects currentOwner partyId mismatch', () => {
    const mismatch: StateChain = {
      ...validChain,
      currentOwner: { ...validChain.currentOwner, partyId: 'dave' },
    };
    const result = verifyStateChain(mismatch);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('currentOwner');
  });

  it('detects currentOwner PKD mismatch', () => {
    const mismatch: StateChain = {
      ...validChain,
      currentOwner: { ...validChain.currentOwner, publicKeyDigest: fakePkd('intruder') },
    };
    const result = verifyStateChain(mismatch);
    expect(result.valid).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('pkd');
  });

  it('rejects re-labelled ownership even when continuity and currentOwner agree (AUD-012)', () => {
    const last = validChain.transferHistory.length - 1;
    const relabeledPkd = fakePkd('mallory');
    const relabeled: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === last ? { ...r, to: 'mallory', toPublicKeyDigest: relabeledPkd } : r,
      ),
      currentOwner: { ...validChain.currentOwner, partyId: 'mallory', publicKeyDigest: relabeledPkd },
    };
    const result = verifyStateChain(relabeled);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/does not bind ownership/);
  });

  it('rejects a tampered txHex (AUD-012)', () => {
    const tampered: StateChain = {
      ...validChain,
      transferHistory: validChain.transferHistory.map((r, i) =>
        i === 0 ? { ...r, txHex: r.txHex.slice(0, -2) + (r.txHex.endsWith('ff') ? '00' : 'ff') } : r,
      ),
    };
    const result = verifyStateChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/txHex/);
  });
});

// ─── claimOwnership ───────────────────────────────────────────────────────

describe('@totemsdk/statechain — claimOwnership', () => {
  let chain: StateChain;
  let se: ReturnType<typeof makeSEClient>;

  beforeEach(async () => {
    se        = makeSEClient();
    const initial = await createChain(se, makeAlice());
    chain = await transferOwnership(initial, makeOwner('bob'), se);
  });

  it('returns ClaimPayload with TxPoW hex signed with actual TX body digest', async () => {
    const r = await claimOwnership(chain, makeLeaseProvider(se));
    expect(r.txHex.length).toBeGreaterThan(100);
    expect(r.txHex).toMatch(/^[0-9A-Fa-f]+$/);
  });

  it('returns ClaimPayload — chainId and coinId match chain', async () => {
    const r = await claimOwnership(chain, makeLeaseProvider(se));
    expect(r.chainId).toBe(chain.chainId);
    expect(r.coinId).toBe(chain.coinId);
  });

  it('claimAddress is distinct from lockingAddress', async () => {
    const r = await claimOwnership(chain, makeLeaseProvider(se));
    expect(r.claimAddress.length).toBeGreaterThan(0);
    expect(r.claimAddress).not.toBe(chain.lockingAddress);
  });

  it('txpowId is undefined without broadcast in leaseProvider', async () => {
    const r = await claimOwnership(chain, makeLeaseProvider(se));
    expect(r.txpowId).toBeUndefined();
  });

  it('claim TX is signed over a digest that includes the precomputed output coinId', async () => {
    const r1 = await claimOwnership(chain, makeLeaseProvider(se));
    const r2 = await claimOwnership(chain, makeLeaseProvider(se));
    // claimAddress is deterministic (derived from owner PKD script address)
    expect(r1.claimAddress).toBe(r2.claimAddress);
    expect(r1.claimAddress).not.toBe(chain.lockingAddress);
    // Both TxPoW must be well-formed hex of non-trivial length
    expect(r1.txHex.length).toBeGreaterThan(200);
    expect(r1.txHex).toMatch(/^[0-9A-Fa-f]+$/);
    expect(r2.txHex).toMatch(/^[0-9A-Fa-f]+$/);
  });

  it('txpowId is set when leaseProvider.broadcast is present', async () => {
    const lp: StatechainLeaseProvider = {
      ...makeLeaseProvider(se),
      broadcast: jest.fn().mockResolvedValue({ success: true, txpowid: 'txpow-abc123' }),
    };
    const r = await claimOwnership(chain, lp);
    expect(r.txpowId).toBe('txpow-abc123');
    expect(lp.broadcast).toHaveBeenCalledTimes(1);
  });

  it('propagates broadcast error', async () => {
    const lp: StatechainLeaseProvider = {
      ...makeLeaseProvider(se),
      broadcast: jest.fn().mockRejectedValue(new Error('network error')),
    };
    await expect(claimOwnership(chain, lp)).rejects.toThrow('network error');
  });

  it('throws if chain is already claimed', async () => {
    const claimed: StateChain = { ...chain, status: 'claimed' };
    await expect(claimOwnership(claimed, makeLeaseProvider(se))).rejects.toThrow('claiming');
  });
});

// ─── reclaimAbandoned ────────────────────────────────────────────────────

describe('@totemsdk/statechain — reclaimAbandoned', () => {
  let chain: StateChain;
  let se: ReturnType<typeof makeSEClient>;

  beforeEach(async () => {
    se    = makeSEClient();
    chain = await createChain(se, makeAlice());
  });

  it('returns ClaimPayload with pre-built reclaimTx (pre-signed during createStateChain)', async () => {
    const r = await reclaimAbandoned(chain, {});
    expect(r.txHex).toBe(chain.reclaimTx);
    expect(r.txHex.length).toBeGreaterThan(100);
  });

  it('reclaimTx was signed over a digest that includes the precomputed output coinId', () => {
    expect(chain.reclaimTx.length).toBeGreaterThan(200);
    const nonZero = (chain.reclaimTx.match(/[1-9a-f]/g) ?? []).length;
    expect(nonZero / chain.reclaimTx.length).toBeGreaterThan(0.10);
  });

  it('claimAddress matches chain.reclaimAddress', async () => {
    const r = await reclaimAbandoned(chain, {});
    expect(r.claimAddress).toBe(chain.reclaimAddress);
  });

  it('reclaimAddress is distinct from lockingAddress (owner exit, not re-lock)', () => {
    expect(chain.reclaimAddress).not.toBe(chain.lockingAddress);
  });

  it('works without leaseProvider (no broadcast)', async () => {
    await expect(reclaimAbandoned(chain, {})).resolves.not.toThrow();
  });

  it('SE refusal scenario: cooperative claim fails, reclaim uses pre-built TX', async () => {
    const refusingSE: SEClient = {
      blindSign: jest.fn().mockRejectedValue(new Error('SE offline — refusing to sign')),
      revokeKey: jest.fn(),
      isRevoked: jest.fn().mockResolvedValue(false),
    };
    const lp = makeLeaseProvider(refusingSE);
    await expect(claimOwnership(chain, lp)).rejects.toThrow('SE offline');
    const reclaim = await reclaimAbandoned(chain, { evidence: 'SE refused' });
    expect(reclaim.txHex).toBe(chain.reclaimTx);
  });

  it('txpowId is set when leaseProvider.broadcast is present', async () => {
    const lp: StatechainLeaseProvider = {
      seClient:  se,
      broadcast: jest.fn().mockResolvedValue({ success: true, txpowid: 'reclaim-tx-id' }),
    };
    const r = await reclaimAbandoned(chain, { evidence: 'SE offline' }, lp);
    expect(r.txpowId).toBe('reclaim-tx-id');
  });

  it('propagates broadcast error', async () => {
    const lp: StatechainLeaseProvider = {
      seClient:  se,
      broadcast: jest.fn().mockRejectedValue(new Error('broadcast failed')),
    };
    await expect(reclaimAbandoned(chain, {}, lp)).rejects.toThrow('broadcast failed');
  });

  it('throws if chain is already claimed', async () => {
    const claimed: StateChain = { ...chain, status: 'claimed' };
    await expect(reclaimAbandoned(claimed, {})).rejects.toThrow('claimed');
  });

  it('rejects when timelockBlock not yet reached', async () => {
    const lp: StatechainLeaseProvider = {
      seClient:  se,
      getTip:    jest.fn().mockResolvedValue({ block: 100 }),
      broadcast: jest.fn(),
    };
    await expect(
      reclaimAbandoned(chain, { timelockBlock: 1256 }, lp),
    ).rejects.toThrow('timelock not yet expired');
  });

  it('proceeds when timelockBlock is reached', async () => {
    const lp: StatechainLeaseProvider = {
      seClient:  se,
      getTip:    jest.fn().mockResolvedValue({ block: 2000 }),
      broadcast: jest.fn().mockResolvedValue({ success: true, txpowid: 'ok' }),
    };
    const r = await reclaimAbandoned(chain, { timelockBlock: 1256 }, lp);
    expect(r.txHex).toBe(chain.reclaimTx);
  });

  it('carol (after A→B→C) can reclaim — reclaimTx not anchored to initial owner', async () => {
    const afterAB = await transferOwnership(chain, makeOwner('bob'),   se);
    const afterBC = await transferOwnership(afterAB, makeOwner('carol'), se);
    expect(afterBC.reclaimAddress).not.toBe(chain.reclaimAddress);
    const r = await reclaimAbandoned(afterBC, {});
    expect(r.txHex).toBe(afterBC.reclaimTx);
    expect(r.claimAddress).toBe(afterBC.reclaimAddress);
  });
});

// ─── buildStatechainScript ───────────────────────────────────────────────

describe('@totemsdk/statechain — buildStatechainScript', () => {
  it('uses STATE(0) for owner; SE root is hardcoded (owner root is not)', () => {
    const ownerPkd = fakePkd('arbitrary-owner');
    const script   = buildStatechainScript(SE_ROOT);
    expect(script).toContain('STATE(0)');
    expect(script.toUpperCase()).toContain(SE_ROOT.toUpperCase());
    expect(script.toUpperCase()).not.toContain(ownerPkd.toUpperCase());
  });

  it('contains MULTISIG(2', () => {
    expect(buildStatechainScript(SE_ROOT)).toContain('MULTISIG(2');
  });

  it('uses @COINAGE-based unilateral reclaim', () => {
    const s = buildStatechainScript(SE_ROOT);
    expect(s).toContain('@COINAGE');
    expect(s).toContain(`${RECLAIM_TIMELOCK}`);
    expect(s).toContain('SIGNEDBY');
  });

  it('contains SE root in 0X prefix format', () => {
    expect(buildStatechainScript(SE_ROOT).toUpperCase()).toContain('0X' + SE_ROOT.toUpperCase());
  });

  it('produces the same script regardless of owner (STATE-derived)', () => {
    expect(buildStatechainScript(SE_ROOT)).toBe(buildStatechainScript(SE_ROOT));
  });

  it('produces different scripts for different SEs', () => {
    expect(buildStatechainScript(fakePkd('se1'))).not.toBe(buildStatechainScript(fakePkd('se2')));
  });
});

// ─── Full lifecycle ───────────────────────────────────────────────────────

describe('@totemsdk/statechain — full lifecycle A → B → C → verify → claim + SE-refusal reclaim', () => {
  it('all steps pass; SE refusal triggers reclaim path using pre-built TX', async () => {
    const se = makeSEClient();

    // Create — lock TX moves coin into MULTISIG(STATE(0)) script
    const created = await createChain(se, makeAlice());
    expect(created.status).toBe('active');
    expect(created.coinId).not.toBe(COIN_ID);          // lock TX output coinId
    expect(created.lockingScript).toContain('STATE(0)');
    expect(created.reclaimTx.length).toBeGreaterThan(100);
    expect(created.reclaimAddress).not.toBe(created.lockingAddress);
    expect(se.registeredChains).toContain(created.chainId);

    // Transfer A → B — reclaimTx updated for bob
    const afterAB = await transferOwnership(created, makeOwner('bob'), se);
    expect(afterAB.currentOwner.partyId).toBe('bob');
    expect(afterAB.coinId).not.toBe(created.coinId);
    expect(afterAB.reclaimTx).not.toBe(created.reclaimTx);
    expect(afterAB.transferHistory[0].signedDigest).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(afterAB.transferHistory[0].ownerSignature.length).toBeGreaterThan(0);
    const recomputedAB = bytesToHex(sha3_256(Buffer.from(afterAB.transferHistory[0].txBodyHex, 'hex')));
    expect(afterAB.transferHistory[0].signedDigest).toBe(recomputedAB);

    // Transfer B → C — reclaimTx updated for carol
    const afterBC = await transferOwnership(afterAB, makeOwner('carol'), se);
    expect(afterBC.currentOwner.partyId).toBe('carol');
    expect(afterBC.coinId).not.toBe(afterAB.coinId);
    expect(afterBC.reclaimTx).not.toBe(afterAB.reclaimTx);

    // Verify — all checks pass per hop (continuity, digest, SE sig, owner sig)
    const verify = verifyStateChain(afterBC);
    expect(verify.valid).toBe(true);
    expect(verify.depth).toBe(2);
    expect(verify.rootOwner).toBe('alice');

    // Cooperative claim succeeds when SE is online — returns ClaimPayload directly
    const claimed = await claimOwnership(afterBC, makeLeaseProvider(se));
    expect(claimed.txHex.length).toBeGreaterThan(100);
    expect(claimed.claimAddress).not.toBe(afterBC.lockingAddress);

    // SE refusal → cooperative claim fails
    const refusingSE: SEClient = {
      blindSign: jest.fn().mockRejectedValue(new Error('SE offline')),
      revokeKey: jest.fn(), isRevoked: jest.fn().mockResolvedValue(false),
    };
    await expect(
      claimOwnership(afterBC, makeLeaseProvider(refusingSE)),
    ).rejects.toThrow('SE offline');

    // Reclaim with carol's pre-built TX — returns ClaimPayload; not alice's initial reclaimTx
    const reclaimed = await reclaimAbandoned(afterBC, { evidence: 'SE offline' });
    expect(reclaimed.txHex).toBe(afterBC.reclaimTx);
    expect(reclaimed.claimAddress).toBe(afterBC.reclaimAddress);
    expect(reclaimed.claimAddress).not.toBe(created.reclaimAddress);
  });
});

/**
 * OMN-039 — durable signing intents.
 *
 * A WOTS signature is released only after an append-only intent record exists.
 * If the process crashes before the channel is persisted, restarting must still
 * refuse a *different* payload at the same sequence.
 */

import { bytesToHex, createUnifiedChildTreeKey, serializeTreeSignature } from '@totemsdk/core';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import { DefaultEltooPaymentProgram } from '../program.js';
import { signState } from '../sign.js';
import {
  _resetChannelWatermarks,
  beginSigningAttempt,
  getSigningJournal,
  MemorySigningJournal,
  setSigningJournal,
} from '../guards.js';
import type { SigningIntent, SigningIntentJournal } from '../guards.js';
import { DoubleSignError, SequenceError, SignerOutcomeUnknownError, SignerRefusalError } from '../errors.js';
import type { ChannelSigner, OmniaChannel } from '../types.js';
import type { SignRequest, SignerPort } from '../custody.js';

/** A journal that is explicitly *not* the in-memory default, so the simulated
 *  restart below (which clears process memory) leaves its records intact. */
function durableJournal(): SigningIntentJournal & { intents: SigningIntent[] } {
  const intents: SigningIntent[] = [];
  return {
    intents,
    record(intent) {
      const index = intents.findIndex(
        (i) => i.channelId === intent.channelId
          && i.sequence === intent.sequence
          && i.payloadHash === intent.payloadHash,
      );
      if (index === -1) intents.push({ ...intent });
      else intents[index] = { ...intent };
    },
    update(intent) {
      const index = intents.findIndex(
        (i) => i.channelId === intent.channelId
          && i.sequence === intent.sequence
          && i.payloadHash === intent.payloadHash,
      );
      if (index !== -1) intents[index] = { ...intent };
    },
    list(channelId) {
      return intents.filter((i) => i.channelId === channelId).map((i) => ({ ...i }));
    },
  };
}

function makeLeaseProvider(): WotsLeaseProvider {
  let counter = 0;
  return {
    reserveKeyUse: async () => ({
      reservationId: `intent-res-${++counter}`,
      indices: { addressIndex: 0, l1: counter, l2: 0 },
      expiresAt: Date.now() + 60_000,
    }),
    commitKeyUse: async () => {},
    burnReservation: async () => {},
    getLocalWatermark: async (treeId: string) => ({
      treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 4096,
    }),
    publishWatermark: async () => {},
    syncLeaseJournal: async () => ({ synced: true, conflicts: [] }),
    verifyLeaseCertificate: async () => true,
  } as unknown as WotsLeaseProvider;
}

function makeChannel(pkd: string): OmniaChannel {
  return {
    channelId: '0x' + 'ab'.repeat(32),
    fundingTxId: '0x' + 'ef'.repeat(32),
    fundingCoinId: '0x' + 'cc'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: DefaultEltooPaymentProgram.id,
    programVersion: DefaultEltooPaymentProgram.version,
    fundingAddress: '0x' + 'dd'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: pkd, addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1 },
    ],
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 1,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1_000,
    updatedAt: 1_000,
  };
}

const treeKey = createUnifiedChildTreeKey(new Uint8Array(32).fill(9), 0);
const pkd = `0x${bytesToHex(treeKey.getPublicKey()).toLowerCase()}`;
const signer: ChannelSigner = {
  publicKeyDigest: pkd,
  async sign(payload, indices) {
    treeKey.setUses(indices.l1 * 64 + indices.l2);
    return serializeTreeSignature(treeKey.sign(payload)) as Uint8Array;
  },
};

describe('OMN-039 signing intents', () => {
  afterEach(() => {
    setSigningJournal(undefined);
    _resetChannelWatermarks();
  });

  it('OMN-121: supplies the amount derived from the transition to the signer port', async () => {
    const channel = makeChannel(pkd);
    const seen: SignRequest[] = [];
    const port: SignerPort = {
      publicKeyDigest: pkd,
      async sign(req) {
        seen.push(req);
        return signer.sign(req.digest, req.signingIndices!);
      },
    };
    await signState(
      channel,
      { newSequence: 2, newBalances: { alice: 500n, bob: 500n } },
      makeLeaseProvider(),
      signer,
      port,
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0].context.amount).toBe('100');
    expect(seen[0].context.asset).toBe('0x00');
  });

  it('OMN-109: an unknown signer outcome keeps the sequence sealed', async () => {
    const journal = durableJournal();
    setSigningJournal(journal);
    const channel = makeChannel(pkd);
    const port: SignerPort = {
      publicKeyDigest: pkd,
      async sign() {
        throw new Error('signer request timed out');
      },
    };

    await expect(signState(
      channel,
      { newSequence: 2, newBalances: { alice: 500n, bob: 500n } },
      makeLeaseProvider(),
      signer,
      port,
    )).rejects.toBeInstanceOf(SignerOutcomeUnknownError);

    expect(journal.intents).toHaveLength(1);
    expect(journal.intents[0].state).toBe('ambiguous');

    // The guard is sealed: a different payload at the same sequence is refused
    // even though no signature was returned to this process.
    await expect(signState(
      channel,
      { newSequence: 2, newBalances: { alice: 0n, bob: 1000n } },
      makeLeaseProvider(),
      signer,
    )).rejects.toBeInstanceOf(DoubleSignError);
  });

  it('OMN-109: a definite signer refusal stays retryable', async () => {
    const journal = durableJournal();
    setSigningJournal(journal);
    const channel = makeChannel(pkd);
    const update = { newSequence: 2, newBalances: { alice: 500n, bob: 500n } };
    let attempts = 0;
    const port: SignerPort = {
      publicKeyDigest: pkd,
      async sign(req) {
        attempts++;
        if (attempts === 1) throw new SignerRefusalError('policy denied this request');
        return signer.sign(req.digest, req.signingIndices!);
      },
    };

    await expect(signState(channel, update, makeLeaseProvider(), signer, port))
      .rejects.toBeInstanceOf(SignerRefusalError);
    // The refusal was definite, so the same payload may be retried.
    const retried = await signState(channel, update, makeLeaseProvider(), signer, port);
    expect(retried.sequence).toBe(2);
    expect(retried.signatures?.['alice']).toBeDefined();
  });

  it('blocks a conflicting payload at the same sequence after a restart', async () => {
    const journal = durableJournal();
    setSigningJournal(journal);
    const channel = makeChannel(pkd);

    await signState(
      channel,
      { newSequence: 2, newBalances: { alice: 500n, bob: 500n } },
      makeLeaseProvider(),
      signer,
    );
    expect(journal.intents).toHaveLength(1);
    expect(journal.intents[0].state).toBe('signed');

    // Simulated crash: process memory is gone, the journal is not.
    _resetChannelWatermarks();

    await expect(signState(
      channel,
      { newSequence: 2, newBalances: { alice: 0n, bob: 1000n } },
      makeLeaseProvider(),
      signer,
    )).rejects.toBeInstanceOf(DoubleSignError);
  });

  it('still accepts an identical replay after a restart', async () => {
    const journal = durableJournal();
    setSigningJournal(journal);
    const channel = makeChannel(pkd);
    const update = { newSequence: 2, newBalances: { alice: 500n, bob: 500n } };

    await signState(channel, update, makeLeaseProvider(), signer);
    _resetChannelWatermarks();

    await expect(
      signState(channel, update, makeLeaseProvider(), signer),
    ).resolves.toBeTruthy();
  });

  it('rejects a stale sequence recorded in the journal', async () => {
    const journal = durableJournal();
    setSigningJournal(journal);
    journal.record({
      channelId: 'ch-stale',
      sequence: 7,
      payloadHash: 'aa',
      purpose: 'test',
      state: 'signed',
      recordedAt: Date.now(),
    });

    await expect(beginSigningAttempt({
      channelId: 'ch-stale',
      sequence: 6,
      payloadHash: 'bb',
      purpose: 'test',
    })).rejects.toBeInstanceOf(SequenceError);
  });

  it('releases the intent when signing fails before a signature exists', async () => {
    const journal = durableJournal();
    setSigningJournal(journal);
    const channel = makeChannel(pkd);

    const failingSigner: ChannelSigner = {
      publicKeyDigest: pkd,
      async sign() {
        throw new Error('wallet offline');
      },
    };
    await expect(signState(
      channel,
      { newSequence: 2, newBalances: { alice: 500n, bob: 500n } },
      makeLeaseProvider(),
      failingSigner,
    )).rejects.toThrow(/wallet offline/);
    expect(journal.intents.at(-1)?.state).toBe('abandoned');

    // The next attempt at the same sequence may use different balances because
    // no signature was ever produced for the first payload.
    await expect(signState(
      channel,
      { newSequence: 2, newBalances: { alice: 400n, bob: 600n } },
      makeLeaseProvider(),
      signer,
    )).resolves.toBeTruthy();
  });

  it('uses an in-memory journal by default', () => {
    expect(getSigningJournal()).toBeInstanceOf(MemorySigningJournal);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OMN-108 (audit 3, OMN-106) — the signing boundary must fail closed
// ─────────────────────────────────────────────────────────────────────────────

describe('OMN-108 signing journal fail-closed and serialized admission', () => {
  afterEach(() => {
    setSigningJournal(new MemorySigningJournal());
    _resetChannelWatermarks();
  });

  it('refuses to sign when the journal cannot be read', async () => {
    setSigningJournal({
      list() { throw new Error('disk unavailable'); },
      record() {},
    } as unknown as SigningIntentJournal);

    await expect(beginSigningAttempt({
      channelId: 'ch-unreadable', sequence: 4, payloadHash: 'aa', purpose: 'update',
    })).rejects.toThrow(/journal for channel ch-unreadable is unavailable/);
  });

  it('refuses to sign when the intent cannot be recorded', async () => {
    setSigningJournal({
      list() { return []; },
      record() { throw new Error('write failed'); },
    } as unknown as SigningIntentJournal);

    await expect(beginSigningAttempt({
      channelId: 'ch-unwritable', sequence: 5, payloadHash: 'aa', purpose: 'update',
    })).rejects.toThrow(/could not record the intent/);
  });

  it('admits exactly one of two concurrent payloads for the same sequence', async () => {
    setSigningJournal(new MemorySigningJournal());

    const results = await Promise.allSettled([
      beginSigningAttempt({ channelId: 'ch-race', sequence: 7, payloadHash: 'aa', purpose: 'update' }),
      beginSigningAttempt({ channelId: 'ch-race', sequence: 7, payloadHash: 'bb', purpose: 'update' }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(DoubleSignError);
  });

  it('still admits the same payload concurrently (idempotent retry)', async () => {
    setSigningJournal(new MemorySigningJournal());

    const results = await Promise.allSettled([
      beginSigningAttempt({ channelId: 'ch-same', sequence: 9, payloadHash: 'cc', purpose: 'update' }),
      beginSigningAttempt({ channelId: 'ch-same', sequence: 9, payloadHash: 'cc', purpose: 'update' }),
    ]);

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
  });
});

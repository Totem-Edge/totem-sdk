import { wotsVerifyDigest, fromHex } from '@totemsdk/core';
import { serializeTxBody, mineTxPoW, TX_POW_MIN_DIFFICULTY } from '@totemsdk/txpow';
import { concatBytes } from '@totemsdk/core';
import type { OmniaChannel } from '@totemsdk/omnia';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type {
  SpliceProposal,
  SpliceAcceptance,
  SplicedChannel,
  QuiescedChannel,
} from './types.js';
import { buildSpliceTx, computeSpliceTxDigest, spliceDraftToMinimaBytes } from './splice-tx.js';
import {
  SpliceSignatureMismatchError,
  SpliceMissingPartyError,
  SpliceChannelStatusError,
} from './errors.js';

/**
 * Options for `finalizeSplice`.
 *
 * @property broadcast              - Broadcast the mined TxPoW hex to the network.
 *                                    `finalizeSplice` throws if `broadcast` returns
 *                                    `{ success: false }` without a `txpowid`.
 * @property mineDifficulty         - Override PoW difficulty (pass `MAX_HASH` in tests).
 * @property verifySignature        - Custom signature verifier called for both the
 *                                    proposer and acceptor signatures before state
 *                                    transition. Defaults to `wotsVerifyDigest`.
 *                                    **Override in test environments** that use mock
 *                                    signers (mock signatures are not real WOTS sigs
 *                                    and will not pass the default verifier).
 *
 *                                    ```ts
 *                                    // Example test helper:
 *                                    verifySignature: (sig, digest, pkd) => {
 *                                      const expected = sha3_256(concatBytes(fromHex(pkd), digest));
 *                                      return expected.length === sig.length
 *                                        && expected.every((b, i) => b === sig[i]);
 *                                    }
 *                                    ```
 *
 * @property proposerLeaseProvider  - Proposer's WOTS lease provider. If supplied,
 *                                    `finalizeSplice` will call `commitKeyUse` on the
 *                                    proposer's reservation after a confirmed splice TX,
 *                                    or `burnReservation` if finalization fails after
 *                                    security checks pass. Prevents one-time-key reuse.
 *
 * @property acceptorLeaseProvider  - Acceptor's WOTS lease provider. Same commit/burn
 *                                    semantics as `proposerLeaseProvider`.
 */
export interface FinalizeSpliceOptions {
  broadcast?: (txHex: string) => Promise<{ txpowid?: string; success?: boolean }>;
  mineDifficulty?: Uint8Array;
  verifySignature?: (
    signature: Uint8Array,
    digest: Uint8Array,
    publicKeyDigest: string,
  ) => boolean;
  proposerLeaseProvider?: WotsLeaseProvider;
  acceptorLeaseProvider?: WotsLeaseProvider;
}

function defaultWotsVerify(sig: Uint8Array, digest: Uint8Array, pkd: string): boolean {
  try {
    return wotsVerifyDigest(sig, digest, fromHex(pkd));
  } catch {
    return false;
  }
}

function assembleSpliceWitness(sig1: Uint8Array, sig2: Uint8Array): Uint8Array {
  const encodeMiniNumber = (n: number): Uint8Array => {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setInt32(0, n, false);
    return buf;
  };
  const encodeVarBytes = (b: Uint8Array): Uint8Array => {
    const lenBuf = new Uint8Array(4);
    new DataView(lenBuf.buffer).setInt32(0, b.length, false);
    return concatBytes(lenBuf, b);
  };
  return concatBytes(
    encodeMiniNumber(2),
    encodeVarBytes(sig1),
    encodeVarBytes(sig2),
    encodeMiniNumber(0),
    encodeMiniNumber(0),
  );
}

/**
 * Structural authorization checks: both parties must be distinct channel
 * members and both signatures must be non-empty Uint8Arrays.
 * Cryptographic WOTS verification is performed separately by
 * `verifySpliceSignatures`.
 */
function validateSpliceAuthorization(
  channel: OmniaChannel | QuiescedChannel,
  proposal: SpliceProposal,
  acceptance: SpliceAcceptance,
): void {
  const proposerParty = channel.parties.find(
    p => p.publicKeyDigest === proposal.proposerPublicKeyDigest,
  );
  if (!proposerParty) throw new SpliceMissingPartyError(proposal.proposerPublicKeyDigest);

  const acceptorParty = channel.parties.find(
    p => p.publicKeyDigest === acceptance.acceptorPublicKeyDigest,
  );
  if (!acceptorParty) throw new SpliceMissingPartyError(acceptance.acceptorPublicKeyDigest);

  if (proposal.proposerPublicKeyDigest === acceptance.acceptorPublicKeyDigest) {
    throw new Error('Proposer and acceptor must be different channel parties');
  }

  if (!proposal.proposerSignature || proposal.proposerSignature.length === 0) {
    throw new SpliceSignatureMismatchError('Proposer signature is empty');
  }
  if (!acceptance.acceptorSignature || acceptance.acceptorSignature.length === 0) {
    throw new SpliceSignatureMismatchError('Acceptor signature is empty');
  }
}

/**
 * Cryptographically verify both parties' signatures against the splice TX
 * digest. Called after structural checks; fails closed — throws on any
 * invalid signature.
 *
 * The digest covers the full canonical TX structure AND `newBalances` (sorted
 * by partyId), so signatures are bound to the exact per-party balance split.
 */
function verifySpliceSignatures(
  proposal: SpliceProposal,
  acceptance: SpliceAcceptance,
  verifier: (sig: Uint8Array, digest: Uint8Array, pkd: string) => boolean,
): void {
  const digest = computeSpliceTxDigest(proposal.spliceTxDraft);

  if (!verifier(proposal.proposerSignature, digest, proposal.proposerPublicKeyDigest)) {
    throw new SpliceSignatureMismatchError(
      'Proposer signature failed cryptographic verification — digest or key mismatch',
    );
  }
  if (!verifier(acceptance.acceptorSignature, digest, acceptance.acceptorPublicKeyDigest)) {
    throw new SpliceSignatureMismatchError(
      'Acceptor signature failed cryptographic verification — digest or key mismatch',
    );
  }
}

/**
 * Cryptographically bind the proposal's spliceTxDraft to its params by
 * recomputing the draft deterministically and comparing digests.
 *
 * Prevents state divergence: finalizeSplice uses spliceTxDraft for the
 * on-chain TX but applies channel state changes from params. If they are
 * inconsistent, the new channel state would not match what was actually mined.
 */
function bindFinalizeParamsToDraft(
  channel: OmniaChannel | QuiescedChannel,
  proposal: SpliceProposal,
): void {
  const recomputed = buildSpliceTx(channel as OmniaChannel, proposal.params);
  const expected = computeSpliceTxDigest(recomputed);
  const actual = computeSpliceTxDigest(proposal.spliceTxDraft);
  if (!expected.every((b, i) => b === actual[i])) {
    throw new Error(
      'finalizeSplice: proposal.spliceTxDraft is inconsistent with proposal.params — ' +
      'rejecting to prevent on-chain/off-chain state divergence',
    );
  }
}

/**
 * Finalize a splice by assembling both parties' signatures, mining PoW,
 * optionally broadcasting the TX, and returning the new active channel.
 *
 * **Quiesce gate**: the channel must be in `'quiesced'` state. Call
 * `quiesceChannel` first to settle all HTLCs and sign the pre-splice state.
 *
 * **Security checks** (all verified before mining):
 *  1. `channel.status === 'quiesced'`
 *  2. `proposal.spliceId === acceptance.spliceId`
 *  3. `proposal.channelId` and `acceptance.channelId` match `channel.channelId`
 *  4. Proposer and acceptor are distinct, non-empty-keyed channel parties
 *  5. Both signatures are non-empty byte arrays
 *  6. Both signatures pass cryptographic verification against the splice TX
 *     digest (WOTS by default; override with `options.verifySignature` in tests)
 *  7. `spliceTxDraft` digest matches what `buildSpliceTx(channel, params)` produces
 *
 * **WOTS lease lifecycle**:
 *  - If `options.proposerLeaseProvider` is supplied: `commitKeyUse` is called
 *    after a confirmed splice TX, or `burnReservation` on failure.
 *  - Same for `options.acceptorLeaseProvider`.
 *  - Reservations are tracked independently; only uncommitted ones are burned.
 *
 * **Broadcast failure**: if `broadcast()` returns `{ success: false }` without
 * a `txpowid`, `finalizeSplice` throws and burns any open reservations.
 *
 * **Side effect**: the `channel` object passed in is mutated to
 * `status: 'spliced'` after a successful finalize. This marks the old
 * quiesced channel as invalid; only the returned `SplicedChannel` is live.
 *
 * **Returned SplicedChannel**:
 *  - `status: 'active'`          — ready for new payments immediately
 *  - `totalValue`                 — updated to `proposal.params.newTotalValue`
 *  - `balances`                   — updated to `proposal.params.newBalances`
 *  - `currentSequence: 0`         — fresh WOTS budget
 *  - `latestState: null`          — no cosigned state yet
 *  - `splicedFrom`                — old channel's `channelId`
 *  - `spliceFundingTxId`          — mined (or broadcast) TX ID
 *  - `spliceFundingCoinId`        — `<txId>-0`
 *
 * @param channel    - Quiesced channel (mutated to 'spliced' on success).
 * @param proposal   - Splice proposal from the initiating party.
 * @param acceptance - Co-signature from the accepting party.
 * @param options    - Broadcast, difficulty, verifier, and lease providers.
 * @returns SplicedChannel (`status: 'active'`) with updated value and provenance.
 */
export async function finalizeSplice(
  channel: OmniaChannel | QuiescedChannel,
  proposal: SpliceProposal,
  acceptance: SpliceAcceptance,
  options?: FinalizeSpliceOptions,
): Promise<SplicedChannel> {
  if (channel.status !== 'quiesced') {
    throw new SpliceChannelStatusError('quiesced', channel.status);
  }

  if (proposal.spliceId !== acceptance.spliceId) {
    throw new SpliceSignatureMismatchError(
      `proposal spliceId '${proposal.spliceId}' !== acceptance spliceId '${acceptance.spliceId}'`,
    );
  }
  if (proposal.channelId !== channel.channelId) {
    throw new Error(
      `proposal.channelId '${proposal.channelId}' does not match channel '${channel.channelId}'`,
    );
  }
  if (acceptance.channelId !== channel.channelId) {
    throw new Error(
      `acceptance.channelId '${acceptance.channelId}' does not match channel '${channel.channelId}'`,
    );
  }

  validateSpliceAuthorization(channel, proposal, acceptance);

  const verifier = options?.verifySignature ?? defaultWotsVerify;
  verifySpliceSignatures(proposal, acceptance, verifier);

  bindFinalizeParamsToDraft(channel, proposal);

  const proposerLease = options?.proposerLeaseProvider;
  const acceptorLease = options?.acceptorLeaseProvider;

  // Track which reservations have been committed so we know which to burn on failure.
  const committed = new Set<string>();

  const txBytes = spliceDraftToMinimaBytes(proposal.spliceTxDraft);
  const witnessBytes = assembleSpliceWitness(
    proposal.proposerSignature,
    acceptance.acceptorSignature,
  );

  let spliceFundingTxId: string;

  try {
    const difficulty = options?.mineDifficulty ?? TX_POW_MIN_DIFFICULTY;
    const txBody = serializeTxBody(txBytes, witnessBytes);
    const mined = await mineTxPoW(txBody, difficulty);
    const fullTxPoW = concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01]), txBody);
    const txHex = Buffer.from(fullTxPoW).toString('hex');

    spliceFundingTxId = Buffer.from(mined.txpowId).toString('hex');

    if (options?.broadcast) {
      const result = await options.broadcast(txHex);
      if (result.txpowid) {
        spliceFundingTxId = result.txpowid;
      } else if (result.success === false) {
        throw new Error(
          'Splice TX broadcast rejected by the network — channel state not advanced',
        );
      }
    }

    // Commit leases on confirmed splice TX
    if (proposerLease) {
      await proposerLease.commitKeyUse(proposal.proposerReservationId, spliceFundingTxId);
      committed.add(proposal.proposerReservationId);
    }
    if (acceptorLease) {
      await acceptorLease.commitKeyUse(acceptance.acceptorReservationId, spliceFundingTxId);
      committed.add(acceptance.acceptorReservationId);
    }
  } catch (err) {
    // Burn any reservations that were not yet committed (fail-close lease accounting)
    await Promise.allSettled([
      proposerLease && !committed.has(proposal.proposerReservationId)
        ? proposerLease.burnReservation(proposal.proposerReservationId, 'finalize-failed')
        : undefined,
      acceptorLease && !committed.has(acceptance.acceptorReservationId)
        ? acceptorLease.burnReservation(acceptance.acceptorReservationId, 'finalize-failed')
        : undefined,
    ].filter((x): x is Promise<void> => x !== undefined));
    throw err;
  }

  const spliceFundingCoinId = `${spliceFundingTxId}-0`;
  const params = proposal.params;

  const splicedChannel: SplicedChannel = {
    ...(channel as unknown as OmniaChannel),
    status: 'active',
    splicedFrom: channel.channelId,
    spliceType: params.type,
    spliceFundingTxId,
    spliceFundingCoinId,
    fundingTxId: spliceFundingTxId,
    fundingCoinId: spliceFundingCoinId,
    totalValue: params.newTotalValue,
    balances: params.newBalances,
    currentSequence: 0,
    latestState: null,
    pendingHTLCs: [],
    stateLog: [
      ...channel.stateLog,
      {
        sequence: 0,
        timestamp: Date.now(),
        balances: { ...params.newBalances },
        htlcCount: 0,
        event: 'update',
      },
    ],
    updatedAt: Date.now(),
  };

  // Mark the old (quiesced) channel as spliced — it is now invalidated.
  // Any further operations on `channel` should be rejected by status checks.
  (channel as unknown as OmniaChannel).status = 'spliced';

  return splicedChannel;
}

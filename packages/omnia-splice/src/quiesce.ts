import { updateState } from '@totemsdk/omnia';
import type { OmniaChannel } from '@totemsdk/omnia';
import type { QuiescedChannel, SpliceLeaseProvider } from './types.js';
import { PendingHTLCError, SpliceChannelStatusError } from './errors.js';

/**
 * Options for `quiesceChannel`.
 */
export interface QuiesceOptions {
  /**
   * Called when the channel has pending HTLCs that have not yet reached a
   * terminal state (`fulfilled` or `timed_out`). If provided, `quiesceChannel`
   * invokes this callback with the still-pending HTLCs, giving the caller an
   * opportunity to drive resolution — e.g. submit preimage reveals, wait for
   * timeout blocks, or poll a Minima node — before the quiesce is retried.
   *
   * After the callback resolves, `channel.pendingHTLCs` is re-inspected.  If
   * all HTLCs have moved to a terminal state the quiesce proceeds; if any are
   * still pending, `PendingHTLCError` is thrown.
   *
   * If this option is not provided, `PendingHTLCError` is thrown immediately
   * when pending HTLCs are found.
   *
   * @param pending - The HTLCs that still need resolution.
   */
  awaitResolution?: (pending: OmniaChannel['pendingHTLCs']) => Promise<void>;
}

/**
 * Quiesce a channel before splicing.
 *
 * Quiescing is mandatory before a splice can be proposed or accepted. It:
 *   1. Validates the channel is `'active'`.
 *   2. Ensures all in-flight HTLCs have reached a terminal state
 *      (`fulfilled` or `timed_out`). If pending HTLCs exist and
 *      `options.awaitResolution` is provided, the callback is invoked so the
 *      caller can drive/await resolution (submit preimages, wait for timeouts,
 *      poll a node). After the callback the channel is re-checked. If HTLCs
 *      remain pending, `PendingHTLCError` is thrown. If the option is absent
 *      and pending HTLCs exist, `PendingHTLCError` is thrown immediately.
 *   3. Signs a final state update (via `updateState`) that captures the settled
 *      balance split at `currentSequence + 1`. This produces a WOTS-signed
 *      `Partial<SignedChannelState>` binding both parties to the pre-splice
 *      balance before the splice TX resets the sequence to 0.
 *   4. Returns a `QuiescedChannel` with `status: 'quiesced'`, `pendingHTLCs: []`
 *      (all resolved HTLCs cleared), and `quiesceSignedState` containing the
 *      local party's partial signature over the final balance state.
 *
 * The caller must exchange `quiesceSignedState` with the counterparty to obtain
 * their co-signature, providing a fully signed record of the last pre-splice
 * balance for any future dispute resolution.
 *
 * @param channel       - The active channel to quiesce.
 * @param leaseProvider - Provides the local party's signer and WOTS lease.
 * @param options       - Optional: `awaitResolution` callback for HTLC settlement.
 * @returns A QuiescedChannel with `status: 'quiesced'`, cleared `pendingHTLCs`,
 *          and the local party's partial signature over the final balance state.
 * @throws {SpliceChannelStatusError} If channel is not active.
 * @throws {PendingHTLCError}         If HTLCs remain pending after resolution.
 */
export async function quiesceChannel(
  channel: OmniaChannel,
  leaseProvider: SpliceLeaseProvider,
  options?: QuiesceOptions,
): Promise<QuiescedChannel> {
  if (channel.status !== 'active') {
    throw new SpliceChannelStatusError('active', channel.status);
  }

  const pendingHTLCs = channel.pendingHTLCs.filter(h => h.status === 'pending');
  if (pendingHTLCs.length > 0) {
    if (options?.awaitResolution) {
      await options.awaitResolution(pendingHTLCs);
      const stillPending = channel.pendingHTLCs.filter(h => h.status === 'pending').length;
      if (stillPending > 0) {
        throw new PendingHTLCError(stillPending);
      }
    } else {
      throw new PendingHTLCError(pendingHTLCs.length);
    }
  }

  const { channel: updatedChannel, signedState, error } = await updateState(
    channel,
    { newBalances: channel.balances },
    leaseProvider.wotsLease,
    leaseProvider.signer,
  );

  if (error) {
    throw new Error(`quiesceChannel: updateState blocked — ${error}. Splice cannot proceed.`);
  }

  const quiesced: QuiescedChannel = {
    ...(updatedChannel as Omit<OmniaChannel, 'status'>),
    status: 'quiesced',
    pendingHTLCs: [],
    quiesceSignedState: signedState,
    updatedAt: Date.now(),
  } as QuiescedChannel;

  return quiesced;
}

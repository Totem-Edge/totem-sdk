export { quiesceChannel, type QuiesceOptions } from './quiesce.js';
export { buildSpliceTx, spliceDraftToMinimaBytes, computeSpliceTxDigest } from './splice-tx.js';
export { proposeSpliceIn, proposeSpliceOut, acceptSplice } from './splice.js';
export { finalizeSplice, type FinalizeSpliceOptions } from './finalize.js';

export type {
  SpliceType,
  SpliceParams,
  SpliceTxDraft,
  SpliceTxInput,
  SpliceTxOutput,
  SpliceProposal,
  SpliceAcceptance,
  QuiescedChannel,
  SplicedChannel,
  SpliceLeaseProvider,
  SpliceSigningIndices,
  WotsSignature,
} from './types.js';

export {
  SpliceError,
  PendingHTLCError,
  SpliceChannelStatusError,
  SpliceBalanceConservationError,
  SpliceSignatureMismatchError,
  SpliceMissingPartyError,
  SpliceInsufficientFundsError,
} from './errors.js';

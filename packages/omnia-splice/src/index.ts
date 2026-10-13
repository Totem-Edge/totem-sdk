export {
  quiesceChannel,
  type QuiesceOptions
} from './quiesce.js';
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

export {
  createDurableSpliceStore,
} from './durable-splice-store.js';
export type {
  SpliceRecord,
  SpliceRecordStatus,
  SpliceStoreState,
  DurableSpliceStore,
  DurableSpliceStoreOptions,
} from './durable-splice-store.js';

// RFC-035 B1 — splice peer round-trip over the coordination transport.
export {
  createSpliceCoordination,
  type SpliceCoordination,
  type SpliceCoordinationDeps,
  type SpliceProposeParams,
  type SpliceApproval,
  type SpliceApprovalRequest,
  type VerifySignature,
} from './coordination.js';
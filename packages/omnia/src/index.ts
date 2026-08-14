export type {
  OmniaChannel,
  ChannelParticipant,
  SignedChannelState,
  SignedClosePackage,
  ClosePackageArtifact,
  ChannelStatus,
  CapacityWarning,
  HTLCRecord,
  ChannelWatermark,
  ChannelLogEntry,
  SettlementPayload,
  DisputePayload,
  UnilateralCloseStartResult,
  UnilateralCloseFinalizeResult,
  ChannelReceipt,
  CreateChannelParams,
  ChannelProposal,
  AddHTLCParams,
  OmniaTxDraft,
  TxInputDraft,
  TxOutputDraft,
  ChannelSigner,
  VerifyStateOptions,
  UpdateDelta,
  ApplyProgramTransitionParams,
  UpdateStateResult,
  IntentResult,
  StateValue,
  ChannelProgram,
  ChannelProgramBuildStateInput,
  ChannelProgramValidateTransitionInput,
  ChannelProgramValidationResult,
  ProgramTransition,
  partyId,
} from './types.js';

export type { PaymentIntent, AgentPolicy, AgentReceipt } from './types.js';

export {
  ChannelCapacityError,
  DoubleSignError,
  BalanceConservationError,
  SequenceError,
  SigningIndexMonotonicityError,
  ChannelStatusError,
} from './errors.js';

export {
  buildEltooScript,
  normalizeScript,
  scriptAddress,
  buildAndHashEltooScript,
  COINID_ELTOO,
  ELTOO_CONTEST_DELAY_BLOCKS,
} from './script.js';

export {
  buildFundingTx,
  buildUpdateTx,
  buildSettlementTx,
  serializeTxDraft,
  deserializeTxDraft,
  computeTxDraftDigest,
  computeLegacyTxDraftDigest,
  computeOmniaTxDigest,
  omniaDraftToCanonicalMinimaBytes,
  omniaDraftToMinimaBytes,
  minimaOutputCoinIdsForDraft,
  toEnhancedBuildParams,
  computeStateCommitment,
  computeStateCommitmentV2,
  stateCommitmentV2Matches,
  buildTxPoWPayload,
  toRawMinima,
  COINID_OUTPUT,
  STATE_SETTLEMENT_PORT,
  STATE_SEQUENCE_PORT,
  STATE_COMMITMENT_V2_PORT,
} from './transactions.js';

export {
  WOTS_CAPACITY_TOTAL,
  CAPACITY_WARNING_APPROACHING,
  CAPACITY_WARNING_CRITICAL,
  CAPACITY_NEAR_EXHAUSTION,
  assessCapacity,
  flatSigningIndex,
} from './capacity.js';

export {
  signTxDraft,
  signState,
  verifyStateSignature,
  validateStateTransition,
  verifyState,
  verifyStateForCoSign,
} from './sign.js';

export {
  validateChannelStateWithKissvm,
} from './kissvm.js';
export type { KissvmValidationOptions } from './kissvm.js';

export {
  DefaultEltooPaymentProgram,
  CounterProgram,
  MeterProgram,
  HTLCPaymentProgram,
  VaultProgram,
  TreasuryProgram,
  MembershipProgram,
  AssetProgram,
  COUNTER_ACTION_DECREMENT,
  COUNTER_ACTION_INCREMENT,
  COUNTER_ACTION_NONE,
  COUNTER_ACTION_PORT,
  COUNTER_ACTION_SET,
  COUNTER_OPERAND_PORT,
  COUNTER_PROGRAM_ID,
  COUNTER_STATE_PORT,
  ELTOO_PAYMENT_PROGRAM_ID,
  METER_PAYMENT_PORT,
  METER_PROGRAM_ID,
  METER_READING_PORT,
  METER_UNIT_PRICE_PORT,
  METER_USAGE_DELTA_PORT,
  HTLC_CLAIMED_PORT,
  HTLC_HASHLOCK_PORT,
  HTLC_LOCKED_AMOUNT_PORT,
  HTLC_PROGRAM_ID,
  HTLC_TIMEOUT_BLOCK_PORT,
  VAULT_LOCKED_VALUE_PORT,
  VAULT_PROGRAM_ID,
  VAULT_RELEASE_SEQUENCE_PORT,
  VAULT_SWEPT_PORT,
  TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT,
  TREASURY_OUTCOME_PROOF_ID_PORT,
  TREASURY_PROGRAM_ID,
  TREASURY_SPEND_CAP_PORT,
  TREASURY_SPENT_PORT,
  TREASURY_VOTE_TALLY_HASH_PORT,
  MEMBERSHIP_DIVIDEND_POOL_PORT,
  MEMBERSHIP_MEMBER_ROOT_PORT,
  MEMBERSHIP_PAYOUT_SEQUENCE_PORT,
  MEMBERSHIP_PROGRAM_ID,
  ASSET_HOLDER_A_BALANCE_PORT,
  ASSET_HOLDER_B_BALANCE_PORT,
  ASSET_PROGRAM_ID,
  ASSET_TOKEN_ID_PORT,
  ASSET_TOTAL_PORT,
  buildProgramUpdateTx,
  computeProgramUpdateDigest,
  computeProgramUpdateDigestHex,
  registerChannelProgram,
  resolveChannelProgram,
} from './program.js';

export {
  canonicalizeProgramTransition,
  serializeProgramTransition,
} from './transition.js';

export {
  snapshotChannel,
  serializeChannelSnapshot,
  deserializeChannelSnapshot,
  recoverChannelSnapshot,
  recoverChannel,
} from './persistence.js';
export type { OmniaChannelSnapshot, ChannelRecoveryResult } from './persistence.js';

export {
  PROGRAM_STATE_PORT_MIN,
  assertProgramStatePort,
  getStateBigInt,
  getStateValue,
  programNumberState,
} from './state-vars.js';

export {
  assertBroadcastProofs,
  closePackageSignatureBytes,
  serializeOmniaWitness,
} from './witness.js';
export type { OmniaWitnessOptions, OmniaWitnessProofs } from './witness.js';

export {
  addClosePackageSignature,
  buildUnsignedClosePackage,
  mergeClosePackages,
  verifyClosePackage,
  verifyPartialClosePackage,
} from './close-package.js';

export {
  enforceUpdateGuards,
  _resetChannelWatermarks,
  createChannel,
  acceptChannel,
  updateState,
  applyProgramTransition,
  attachCounterpartySignature,
  getChannelReceipt,
  activateChannel,
} from './channel.js';

export {
  addHTLC,
  fulfillHTLC,
  timeoutHTLC,
} from './htlc.js';

export {
  decrementCounter,
  incrementCounter,
  setCounter,
} from './counter.js';

export {
  recordMeterReading,
} from './meter.js';

export {
  proposeSettlement,
  startUnilateralClose,
  finalizeUnilateralClose,
  replaceUnilateralCloseState,
  buildDisputePayload,
  markChannelClosing,
  markChannelClosed,
} from './settlement.js';

export { executeIntent } from './intent.js';

export type {
  OmniaMessageType,
  OmniaMessage,
  Unsubscribe,
  OmniaPeer,
  RelayConfig,
  OmniaSwarmConfig,
  OmniaSwarm,
} from './messaging-types.js';

export {
  OmniaFrameParser,
  encodeOmniaMessage,
  FramingError,
} from './framing.js';

export { channelTopic, peerTopic, broadcastTopic } from './topic.js';

export { OmniaStream } from './stream.js';

export { OmniaPeerImpl } from './peer.js';
export type { OmniaPeerOptions } from './peer.js';

export { OmniaSwarmImpl, createOmniaSwarm, createOmniaSwarmFromInstance } from './swarm.js';

export { HostedRelaySwarmImpl, createOmniaSwarmFromRelayUrl } from './relay.js';

export {
  buildProgramTransitionStateUpdateMessage,
  bindPeerIntegration,
  createOmniaIntegration,
  sendProgramTransitionStateUpdate,
} from './integration.js';
export type {
  OmniaIntegrationConfig,
  ChannelStore,
  BindPeerOptions,
  WotsLeaseProviderLike,
  MinimalChainProvider,
} from './integration.js';

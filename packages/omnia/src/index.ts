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
} from './sign.js';

export {
  validateChannelStateWithKissvm,
} from './kissvm.js';
export type { KissvmValidationOptions } from './kissvm.js';

export {
  DefaultEltooPaymentProgram,
  ELTOO_PAYMENT_PROGRAM_ID,
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
  bindPeerIntegration,
  createOmniaIntegration,
} from './integration.js';
export type {
  OmniaIntegrationConfig,
  ChannelStore,
  BindPeerOptions,
  WotsLeaseProviderLike,
  MinimalChainProvider,
} from './integration.js';

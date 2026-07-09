export type {
  OmniaChannel,
  ChannelParticipant,
  SignedChannelState,
  ChannelStatus,
  CapacityWarning,
  HTLCRecord,
  ChannelWatermark,
  ChannelLogEntry,
  SettlementPayload,
  DisputePayload,
  ChannelReceipt,
  CreateChannelParams,
  ChannelProposal,
  AddHTLCParams,
  OmniaTxDraft,
  TxInputDraft,
  TxOutputDraft,
  ChannelSigner,
  KissvmEvaluator,
  VerifyStateOptions,
  UpdateDelta,
  UpdateStateResult,
  IntentResult,
  StateValue,
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
} from './script.js';

export {
  buildFundingTx,
  buildUpdateTx,
  buildSettlementTx,
  serializeTxDraft,
  deserializeTxDraft,
  computeTxDraftDigest,
  omniaDraftToMinimaBytes,
  toEnhancedBuildParams,
  computeStateCommitment,
  buildTxPoWPayload,
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
  enforceUpdateGuards,
  _resetChannelWatermarks,
  createChannel,
  acceptChannel,
  updateState,
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

export { PROTOCOL_VERSION } from './messages.js';
export type {
  MessageType,
  LookupMessage,
  HelloMessage,
  AuthChallengeMessage,
  AuthResponseMessage,
  WatchRegisterMessage,
  WatchRemoveMessage,
  GetCoinsMessage,
  GetCoinMessage,
  GetProofMessage,
  GetTipMessage,
  GetTokenMessage,
  BroadcastTxPoWMessage,
  CoinUpdateMessage,
  ProofResponseMessage,
  LeaseReserveMessage,
  LeaseCommitMessage,
  LeaseBurnMessage,
  LeaseWatermarkMessage,
  AppAnnounceMessage,
  AppQueryMessage,
  AppResultMessage,
  AgentAnnounceMessage,
  AgentQueryMessage,
  AgentResultMessage,
  TrustRecordMessage,
  TrustQueryMessage,
  VersionMismatchMessage,
  ErrorMessage,
  PingMessage,
  PongMessage,
} from './messages.js';

export {
  encodeMessage,
  decodeMessage,
  peekFrameLength,
  FramingError,
} from './framing.js';

export {
  messageDigest,
  signMessage,
  verifyMessageAuth,
} from './auth.js';
export type { SignFn, VerifyFn } from './auth.js';

export { checkVersion } from './version.js';
export type { VersionCheckResult } from './version.js';

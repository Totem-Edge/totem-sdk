**@totemsdk/lookup-protocol**

***

# @totemsdk/lookup-protocol

## Classes

- [FramingError](classes/FramingError.md)

## Interfaces

- [AgentAnnounceMessage](interfaces/AgentAnnounceMessage.md)
- [AgentQueryMessage](interfaces/AgentQueryMessage.md)
- [AgentResultMessage](interfaces/AgentResultMessage.md)
- [AppAnnounceMessage](interfaces/AppAnnounceMessage.md)
- [AppQueryMessage](interfaces/AppQueryMessage.md)
- [AppResultMessage](interfaces/AppResultMessage.md)
- [AuthChallengeMessage](interfaces/AuthChallengeMessage.md)
- [AuthResponseMessage](interfaces/AuthResponseMessage.md)
- [BroadcastTxPoWMessage](interfaces/BroadcastTxPoWMessage.md)
- [CoinUpdateMessage](interfaces/CoinUpdateMessage.md)
- [ErrorMessage](interfaces/ErrorMessage.md)
- [GetCoinMessage](interfaces/GetCoinMessage.md)
- [GetCoinsMessage](interfaces/GetCoinsMessage.md)
- [GetProofMessage](interfaces/GetProofMessage.md)
- [GetTipMessage](interfaces/GetTipMessage.md)
- [GetTokenMessage](interfaces/GetTokenMessage.md)
- [HelloMessage](interfaces/HelloMessage.md)
- [LeaseBurnMessage](interfaces/LeaseBurnMessage.md)
- [LeaseCommitMessage](interfaces/LeaseCommitMessage.md)
- [LeaseReserveMessage](interfaces/LeaseReserveMessage.md)
- [LeaseWatermarkMessage](interfaces/LeaseWatermarkMessage.md)
- [PingMessage](interfaces/PingMessage.md)
- [PongMessage](interfaces/PongMessage.md)
- [ProofResponseMessage](interfaces/ProofResponseMessage.md)
- [SignFn](interfaces/SignFn.md)
- [TrustQueryMessage](interfaces/TrustQueryMessage.md)
- [TrustRecordMessage](interfaces/TrustRecordMessage.md)
- [VerifyFn](interfaces/VerifyFn.md)
- [VersionCheckResult](interfaces/VersionCheckResult.md)
- [VersionMismatchMessage](interfaces/VersionMismatchMessage.md)
- [WatchRegisterMessage](interfaces/WatchRegisterMessage.md)
- [WatchRemoveMessage](interfaces/WatchRemoveMessage.md)

## Type Aliases

- [LookupMessage](type-aliases/LookupMessage.md)
- [MessageType](type-aliases/MessageType.md)

## Variables

- [PROTOCOL\_VERSION](variables/PROTOCOL_VERSION.md)

## Functions

- [checkVersion](functions/checkVersion.md)
- [decodeMessage](functions/decodeMessage.md)
- [encodeMessage](functions/encodeMessage.md)
- [messageDigest](functions/messageDigest.md)
- [peekFrameLength](functions/peekFrameLength.md)
- [signMessage](functions/signMessage.md)
- [verifyMessageAuth](functions/verifyMessageAuth.md)

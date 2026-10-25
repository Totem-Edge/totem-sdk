**@totemsdk/lookup-protocol**

***

**Maturity: rc**

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
- [PolicyAnnounceMessage](interfaces/PolicyAnnounceMessage.md)
- [PolicyQueryMessage](interfaces/PolicyQueryMessage.md)
- [PolicyResultMessage](interfaces/PolicyResultMessage.md)
- [PolicySignCancelMessage](interfaces/PolicySignCancelMessage.md)
- [PolicySignRequestMessage](interfaces/PolicySignRequestMessage.md)
- [PolicySignResponseMessage](interfaces/PolicySignResponseMessage.md)
- [PolicyUpdateMessage](interfaces/PolicyUpdateMessage.md)
- [PolicyWatchMessage](interfaces/PolicyWatchMessage.md)
- [PongMessage](interfaces/PongMessage.md)
- [ProofResponseMessage](interfaces/ProofResponseMessage.md)
- [SessionCloseMessage](interfaces/SessionCloseMessage.md)
- [SessionOpenMessage](interfaces/SessionOpenMessage.md)
- [SessionTicket](interfaces/SessionTicket.md)
- [SessionTicketMessage](interfaces/SessionTicketMessage.md)
- [SessionTicketRef](interfaces/SessionTicketRef.md)
- [SignFn](interfaces/SignFn.md)
- [TrustQueryMessage](interfaces/TrustQueryMessage.md)
- [TrustRecordMessage](interfaces/TrustRecordMessage.md)
- [VerifyFn](interfaces/VerifyFn.md)
- [VersionCheckResult](interfaces/VersionCheckResult.md)
- [VersionMismatchMessage](interfaces/VersionMismatchMessage.md)
- [WatchRegisterMessage](interfaces/WatchRegisterMessage.md)
- [WatchRemoveMessage](interfaces/WatchRemoveMessage.md)
- [WotsAuthEnvelope](interfaces/WotsAuthEnvelope.md)

## Type Aliases

- [LookupMessage](type-aliases/LookupMessage.md)
- [MessageType](type-aliases/MessageType.md)

## Variables

- [MAX\_FRAME\_BODY\_LENGTH](variables/MAX_FRAME_BODY_LENGTH.md)
- [PROTOCOL\_VERSION](variables/PROTOCOL_VERSION.md)

## Functions

- [authDigest](functions/authDigest.md)
- [canonicalJson](functions/canonicalJson.md)
- [checkVersion](functions/checkVersion.md)
- [decodeMessage](functions/decodeMessage.md)
- [encodeMessage](functions/encodeMessage.md)
- [peekFrameLength](functions/peekFrameLength.md)
- [sessionTicketDigest](functions/sessionTicketDigest.md)
- [signMessage](functions/signMessage.md)
- [verifyMessageAuth](functions/verifyMessageAuth.md)

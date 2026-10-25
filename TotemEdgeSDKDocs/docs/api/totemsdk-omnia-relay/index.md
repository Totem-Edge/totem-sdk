**@totemsdk/omnia-relay**

***

**Maturity: alpha**

# @totemsdk/omnia-relay

## Interfaces

- [ChannelFactory](interfaces/ChannelFactory.md)
- [ForwardIncomingParams](interfaces/ForwardIncomingParams.md)
- [HtlcLink](interfaces/HtlcLink.md)
- [IdentityVerificationResult](interfaces/IdentityVerificationResult.md)
- [MultiHopForwarder](interfaces/MultiHopForwarder.md)
- [MultiHopForwarderOptions](interfaces/MultiHopForwarderOptions.md)
- [OmniaChannel](interfaces/OmniaChannel.md)
- [OmniaRelayClientOptions](interfaces/OmniaRelayClientOptions.md)
- [RelayOmniaClient](interfaces/RelayOmniaClient.md)
- [RelayOmniaClientOptions](interfaces/RelayOmniaClientOptions.md)
- [RelayOmniaOperations](interfaces/RelayOmniaOperations.md)
- [RelayOmniaOperationsOptions](interfaces/RelayOmniaOperationsOptions.md)
- [RelayOmniaSwarmOptions](interfaces/RelayOmniaSwarmOptions.md)
- [RouteQuery](interfaces/RouteQuery.md)
- [RoutingPort](interfaces/RoutingPort.md)
- [WalletApprovalRequest](interfaces/WalletApprovalRequest.md)
- [WalletChannelSigningMaterial](interfaces/WalletChannelSigningMaterial.md)
- [WalletChannelSigningOptions](interfaces/WalletChannelSigningOptions.md)
- [WalletCoordination](interfaces/WalletCoordination.md)
- [WalletCoordinationOptions](interfaces/WalletCoordinationOptions.md)

## Type Aliases

- [ForwardIncomingResult](type-aliases/ForwardIncomingResult.md)
- [QuiescedChannel](type-aliases/QuiescedChannel.md)
- [RevealPreimageResult](type-aliases/RevealPreimageResult.md)
- [SplicedChannel](type-aliases/SplicedChannel.md)
- [WalletApproval](type-aliases/WalletApproval.md)
- [WalletApprovalKind](type-aliases/WalletApprovalKind.md)

## Variables

- [ADVANCED\_UNSUPPORTED](variables/ADVANCED_UNSUPPORTED.md)
- [AXIA\_RELAY\_URL](variables/AXIA_RELAY_URL.md)
- [KEYS\_PER\_LEVEL](variables/KEYS_PER_LEVEL.md)
- [MUTATION\_METHODS](variables/MUTATION_METHODS.md)
- [WALLET\_IDENTITY\_KIND](variables/WALLET_IDENTITY_KIND.md)

## Functions

- [buildGraph](functions/buildGraph.md)
- [channelGraphEdges](functions/channelGraphEdges.md)
- [createChannelRoutingPort](functions/createChannelRoutingPort.md)
- [createMemoryCoordinationStore](functions/createMemoryCoordinationStore.md)
- [createMultiHopForwarder](functions/createMultiHopForwarder.md)
- [createOmniaRelayClient](functions/createOmniaRelayClient.md)
- [createRelayOmniaClient](functions/createRelayOmniaClient.md)
- [createRelayOmniaOperations](functions/createRelayOmniaOperations.md)
- [createRelayOmniaSwarm](functions/createRelayOmniaSwarm.md)
- [createStorageCoordinationStore](functions/createStorageCoordinationStore.md)
- [createWalletChannelSigningMaterial](functions/createWalletChannelSigningMaterial.md)
- [createWalletCoordination](functions/createWalletCoordination.md)
- [fulfillMultiHop](functions/fulfillMultiHop.md)
- [getSwapAnnouncements](functions/getSwapAnnouncements.md)
- [queryRoute](functions/queryRoute.md)
- [relaySwarmUrl](functions/relaySwarmUrl.md)
- [serializeRoute](functions/serializeRoute.md)
- [serializeSwapAnnouncement](functions/serializeSwapAnnouncement.md)
- [verifyChannelParticipantIdentity](functions/verifyChannelParticipantIdentity.md)

[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TotemProvider

# Interface: TotemProvider

## Properties

### isTotem

> **isTotem**: `true`

## Methods

### broadcastHex()

> **broadcastHex**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

###### expectedDigestTx?

`string`

###### signedHex

`string`

#### Returns

`Promise`\<`unknown`\>

***

### enable()

> **enable**(): `Promise`\<[`TotemConnectResponse`](TotemConnectResponse.md)\>

#### Returns

`Promise`\<[`TotemConnectResponse`](TotemConnectResponse.md)\>

***

### getCoins()

> **getCoins**(`params?`): `Promise`\<`unknown`\>

#### Parameters

##### params?

###### address?

`string`

###### minAmount?

`string`

###### tokenId?

`string`

#### Returns

`Promise`\<`unknown`\>

***

### on()

> **on**(`event`, `handler`): `void`

#### Parameters

##### event

`string`

##### handler

(...`args`) => `void`

#### Returns

`void`

***

### removeListener()

> **removeListener**(`event`, `handler`): `void`

#### Parameters

##### event

`string`

##### handler

(...`args`) => `void`

#### Returns

`void`

***

### request()

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemConnectResponse`](TotemConnectResponse.md)\>

##### Parameters

###### args

[`TotemConnectRequest`](TotemConnectRequest.md)

##### Returns

`Promise`\<[`TotemConnectResponse`](TotemConnectResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemVerifyResponse`](TotemVerifyResponse.md)\>

##### Parameters

###### args

[`TotemVerifyRequest`](TotemVerifyRequest.md)

##### Returns

`Promise`\<[`TotemVerifyResponse`](TotemVerifyResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemGetAccountsResponse`](TotemGetAccountsResponse.md)\>

##### Parameters

###### args

[`TotemGetAccountsRequest`](TotemGetAccountsRequest.md)

##### Returns

`Promise`\<[`TotemGetAccountsResponse`](TotemGetAccountsResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemSendTransactionResponse`](../type-aliases/TotemSendTransactionResponse.md)\>

##### Parameters

###### args

[`TotemSendTransactionRequest`](TotemSendTransactionRequest.md)

##### Returns

`Promise`\<[`TotemSendTransactionResponse`](../type-aliases/TotemSendTransactionResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemGetCoinsResponse`](../type-aliases/TotemGetCoinsResponse.md)\>

##### Parameters

###### args

[`TotemGetCoinsRequest`](TotemGetCoinsRequest.md)

##### Returns

`Promise`\<[`TotemGetCoinsResponse`](../type-aliases/TotemGetCoinsResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemSendComplexBuildResponse`](TotemSendComplexBuildResponse.md)\>

##### Parameters

###### args

[`TotemSendComplexRequest`](TotemSendComplexRequest.md) & `object`

##### Returns

`Promise`\<[`TotemSendComplexBuildResponse`](TotemSendComplexBuildResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemSendComplexSubmitResponse`](TotemSendComplexSubmitResponse.md)\>

##### Parameters

###### args

[`TotemSendComplexRequest`](TotemSendComplexRequest.md) & `object`

##### Returns

`Promise`\<[`TotemSendComplexSubmitResponse`](TotemSendComplexSubmitResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemSendComplexBuildResponse`](TotemSendComplexBuildResponse.md) \| [`TotemSendComplexSubmitResponse`](TotemSendComplexSubmitResponse.md)\>

##### Parameters

###### args

[`TotemSendComplexRequest`](TotemSendComplexRequest.md)

##### Returns

`Promise`\<[`TotemSendComplexBuildResponse`](TotemSendComplexBuildResponse.md) \| [`TotemSendComplexSubmitResponse`](TotemSendComplexSubmitResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemSignDataResponse`](../type-aliases/TotemSignDataResponse.md)\>

##### Parameters

###### args

[`TotemSignDataRequest`](TotemSignDataRequest.md)

##### Returns

`Promise`\<[`TotemSignDataResponse`](../type-aliases/TotemSignDataResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemBroadcastHexResponse`](../type-aliases/TotemBroadcastHexResponse.md)\>

##### Parameters

###### args

[`TotemBroadcastHexRequest`](TotemBroadcastHexRequest.md)

##### Returns

`Promise`\<[`TotemBroadcastHexResponse`](../type-aliases/TotemBroadcastHexResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemGrantTxPermissionResponse`](TotemGrantTxPermissionResponse.md)\>

##### Parameters

###### args

[`TotemGrantTxPermissionRequest`](TotemGrantTxPermissionRequest.md)

##### Returns

`Promise`\<[`TotemGrantTxPermissionResponse`](TotemGrantTxPermissionResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemRevokeTxPermissionResponse`](TotemRevokeTxPermissionResponse.md)\>

##### Parameters

###### args

[`TotemRevokeTxPermissionRequest`](TotemRevokeTxPermissionRequest.md)

##### Returns

`Promise`\<[`TotemRevokeTxPermissionResponse`](TotemRevokeTxPermissionResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemGetTxPermissionsResponse`](../type-aliases/TotemGetTxPermissionsResponse.md)\>

##### Parameters

###### args

[`TotemGetTxPermissionsRequest`](TotemGetTxPermissionsRequest.md)

##### Returns

`Promise`\<[`TotemGetTxPermissionsResponse`](../type-aliases/TotemGetTxPermissionsResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemCapabilities`](TotemCapabilities.md)\>

##### Parameters

###### args

[`TotemGetCapabilitiesRequest`](TotemGetCapabilitiesRequest.md)

##### Returns

`Promise`\<[`TotemCapabilities`](TotemCapabilities.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemProviderStatus`](TotemProviderStatus.md)\>

##### Parameters

###### args

[`TotemGetProviderStatusRequest`](TotemGetProviderStatusRequest.md)

##### Returns

`Promise`\<[`TotemProviderStatus`](TotemProviderStatus.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemSetChainProviderResponse`](TotemSetChainProviderResponse.md)\>

##### Parameters

###### args

[`TotemSetChainProviderRequest`](TotemSetChainProviderRequest.md)

##### Returns

`Promise`\<[`TotemSetChainProviderResponse`](TotemSetChainProviderResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemGetWotsStatusResponse`](TotemGetWotsStatusResponse.md)\>

##### Parameters

###### args

[`TotemGetWotsStatusRequest`](TotemGetWotsStatusRequest.md)

##### Returns

`Promise`\<[`TotemGetWotsStatusResponse`](TotemGetWotsStatusResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemReserveWotsLeaseResponse`](TotemReserveWotsLeaseResponse.md)\>

##### Parameters

###### args

[`TotemReserveWotsLeaseRequest`](TotemReserveWotsLeaseRequest.md)

##### Returns

`Promise`\<[`TotemReserveWotsLeaseResponse`](TotemReserveWotsLeaseResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemReleaseWotsLeaseResponse`](TotemReleaseWotsLeaseResponse.md)\>

##### Parameters

###### args

[`TotemReleaseWotsLeaseRequest`](TotemReleaseWotsLeaseRequest.md)

##### Returns

`Promise`\<[`TotemReleaseWotsLeaseResponse`](TotemReleaseWotsLeaseResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemSignTransactionResponse`](TotemSignTransactionResponse.md)\>

##### Parameters

###### args

[`TotemSignTransactionRequest`](TotemSignTransactionRequest.md)

##### Returns

`Promise`\<[`TotemSignTransactionResponse`](TotemSignTransactionResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemMineTxPoWResponse`](TotemMineTxPoWResponse.md)\>

##### Parameters

###### args

[`TotemMineTxPoWRequest`](TotemMineTxPoWRequest.md)

##### Returns

`Promise`\<[`TotemMineTxPoWResponse`](TotemMineTxPoWResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemBroadcastTxPoWResponse`](TotemBroadcastTxPoWResponse.md)\>

##### Parameters

###### args

[`TotemBroadcastTxPoWRequest`](TotemBroadcastTxPoWRequest.md)

##### Returns

`Promise`\<[`TotemBroadcastTxPoWResponse`](TotemBroadcastTxPoWResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemCreatePaymentRequestResponse`](TotemCreatePaymentRequestResponse.md)\>

##### Parameters

###### args

[`TotemCreatePaymentRequestRequest`](TotemCreatePaymentRequestRequest.md)

##### Returns

`Promise`\<[`TotemCreatePaymentRequestResponse`](TotemCreatePaymentRequestResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemPayPaymentRequestResponse`](TotemPayPaymentRequestResponse.md)\>

##### Parameters

###### args

[`TotemPayPaymentRequestRequest`](TotemPayPaymentRequestRequest.md)

##### Returns

`Promise`\<[`TotemPayPaymentRequestResponse`](TotemPayPaymentRequestResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemGetTransactionStatusResponse`](TotemGetTransactionStatusResponse.md)\>

##### Parameters

###### args

[`TotemGetTransactionStatusRequest`](TotemGetTransactionStatusRequest.md)

##### Returns

`Promise`\<[`TotemGetTransactionStatusResponse`](TotemGetTransactionStatusResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemGetReceiptResponse`](TotemGetReceiptResponse.md)\>

##### Parameters

###### args

[`TotemGetReceiptRequest`](TotemGetReceiptRequest.md)

##### Returns

`Promise`\<[`TotemGetReceiptResponse`](TotemGetReceiptResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaGetChannelsResponse`](TotemOmniaGetChannelsResponse.md)\>

##### Parameters

###### args

[`TotemOmniaGetChannelsRequest`](TotemOmniaGetChannelsRequest.md)

##### Returns

`Promise`\<[`TotemOmniaGetChannelsResponse`](TotemOmniaGetChannelsResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaOpenChannelResponse`](TotemOmniaOpenChannelResponse.md)\>

##### Parameters

###### args

[`TotemOmniaOpenChannelRequest`](TotemOmniaOpenChannelRequest.md)

##### Returns

`Promise`\<[`TotemOmniaOpenChannelResponse`](TotemOmniaOpenChannelResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaPayResponse`](TotemOmniaPayResponse.md)\>

##### Parameters

###### args

[`TotemOmniaPayRequest`](TotemOmniaPayRequest.md)

##### Returns

`Promise`\<[`TotemOmniaPayResponse`](TotemOmniaPayResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaSettleResponse`](TotemOmniaSettleResponse.md)\>

##### Parameters

###### args

[`TotemOmniaSettleRequest`](TotemOmniaSettleRequest.md)

##### Returns

`Promise`\<[`TotemOmniaSettleResponse`](TotemOmniaSettleResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaCloseChannelResponse`](TotemOmniaCloseChannelResponse.md)\>

##### Parameters

###### args

[`TotemOmniaCloseChannelRequest`](TotemOmniaCloseChannelRequest.md)

##### Returns

`Promise`\<[`TotemOmniaCloseChannelResponse`](TotemOmniaCloseChannelResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaGetRouteResponse`](TotemOmniaGetRouteResponse.md)\>

##### Parameters

###### args

[`TotemOmniaGetRouteRequest`](TotemOmniaGetRouteRequest.md)

##### Returns

`Promise`\<[`TotemOmniaGetRouteResponse`](TotemOmniaGetRouteResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaPayMultiHopResponse`](TotemOmniaPayMultiHopResponse.md)\>

##### Parameters

###### args

[`TotemOmniaPayMultiHopRequest`](TotemOmniaPayMultiHopRequest.md)

##### Returns

`Promise`\<[`TotemOmniaPayMultiHopResponse`](TotemOmniaPayMultiHopResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaGetSwapRateResponse`](TotemOmniaGetSwapRateResponse.md)\>

##### Parameters

###### args

[`TotemOmniaGetSwapRateRequest`](TotemOmniaGetSwapRateRequest.md)

##### Returns

`Promise`\<[`TotemOmniaGetSwapRateResponse`](TotemOmniaGetSwapRateResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaCreateFactoryResponse`](TotemOmniaCreateFactoryResponse.md)\>

##### Parameters

###### args

[`TotemOmniaCreateFactoryRequest`](TotemOmniaCreateFactoryRequest.md)

##### Returns

`Promise`\<[`TotemOmniaCreateFactoryResponse`](TotemOmniaCreateFactoryResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaOpenVirtualChannelResponse`](TotemOmniaOpenVirtualChannelResponse.md)\>

##### Parameters

###### args

[`TotemOmniaOpenVirtualChannelRequest`](TotemOmniaOpenVirtualChannelRequest.md)

##### Returns

`Promise`\<[`TotemOmniaOpenVirtualChannelResponse`](TotemOmniaOpenVirtualChannelResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaCloseFactoryResponse`](TotemOmniaCloseFactoryResponse.md)\>

##### Parameters

###### args

[`TotemOmniaCloseFactoryRequest`](TotemOmniaCloseFactoryRequest.md)

##### Returns

`Promise`\<[`TotemOmniaCloseFactoryResponse`](TotemOmniaCloseFactoryResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaSpliceInResponse`](TotemOmniaSpliceInResponse.md)\>

##### Parameters

###### args

[`TotemOmniaSpliceInRequest`](TotemOmniaSpliceInRequest.md)

##### Returns

`Promise`\<[`TotemOmniaSpliceInResponse`](TotemOmniaSpliceInResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemOmniaSpliceOutResponse`](TotemOmniaSpliceOutResponse.md)\>

##### Parameters

###### args

[`TotemOmniaSpliceOutRequest`](TotemOmniaSpliceOutRequest.md)

##### Returns

`Promise`\<[`TotemOmniaSpliceOutResponse`](TotemOmniaSpliceOutResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemStatechainCreateResponse`](TotemStatechainCreateResponse.md)\>

##### Parameters

###### args

[`TotemStatechainCreateRequest`](TotemStatechainCreateRequest.md)

##### Returns

`Promise`\<[`TotemStatechainCreateResponse`](TotemStatechainCreateResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemStatechainTransferResponse`](TotemStatechainTransferResponse.md)\>

##### Parameters

###### args

[`TotemStatechainTransferRequest`](TotemStatechainTransferRequest.md)

##### Returns

`Promise`\<[`TotemStatechainTransferResponse`](TotemStatechainTransferResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemStatechainClaimResponse`](TotemStatechainClaimResponse.md)\>

##### Parameters

###### args

[`TotemStatechainClaimRequest`](TotemStatechainClaimRequest.md)

##### Returns

`Promise`\<[`TotemStatechainClaimResponse`](TotemStatechainClaimResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemStatechainVerifyResponse`](TotemStatechainVerifyResponse.md)\>

##### Parameters

###### args

[`TotemStatechainVerifyRequest`](TotemStatechainVerifyRequest.md)

##### Returns

`Promise`\<[`TotemStatechainVerifyResponse`](TotemStatechainVerifyResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemKissvmSimulateResponse`](TotemKissvmSimulateResponse.md)\>

##### Parameters

###### args

[`TotemKissvmSimulateRequest`](TotemKissvmSimulateRequest.md)

##### Returns

`Promise`\<[`TotemKissvmSimulateResponse`](TotemKissvmSimulateResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemKissvmValidateResponse`](TotemKissvmValidateResponse.md)\>

##### Parameters

###### args

[`TotemKissvmValidateRequest`](TotemKissvmValidateRequest.md)

##### Returns

`Promise`\<[`TotemKissvmValidateResponse`](TotemKissvmValidateResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemAgentProposePaymentResponse`](TotemAgentProposePaymentResponse.md)\>

##### Parameters

###### args

[`TotemAgentProposePaymentRequest`](TotemAgentProposePaymentRequest.md)

##### Returns

`Promise`\<[`TotemAgentProposePaymentResponse`](TotemAgentProposePaymentResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemAgentExplainTransactionResponse`](TotemAgentExplainTransactionResponse.md)\>

##### Parameters

###### args

[`TotemAgentExplainTransactionRequest`](TotemAgentExplainTransactionRequest.md)

##### Returns

`Promise`\<[`TotemAgentExplainTransactionResponse`](TotemAgentExplainTransactionResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<[`TotemAgentCreateReceiptResponse`](TotemAgentCreateReceiptResponse.md)\>

##### Parameters

###### args

[`TotemAgentCreateReceiptRequest`](TotemAgentCreateReceiptRequest.md)

##### Returns

`Promise`\<[`TotemAgentCreateReceiptResponse`](TotemAgentCreateReceiptResponse.md)\>

#### Call Signature

> **request**(`args`): `Promise`\<`unknown`\>

##### Parameters

###### args

[`TotemRequest`](TotemRequest.md)

##### Returns

`Promise`\<`unknown`\>

***

### send()

> **send**(`method`, `params?`): `Promise`\<`unknown`\>

#### Parameters

##### method

`string`

##### params?

`unknown`[]

#### Returns

`Promise`\<`unknown`\>

***

### sendComplex()

> **sendComplex**(`buildParams`, `mode?`): `Promise`\<`unknown`\>

#### Parameters

##### buildParams

`Record`\<`string`, `unknown`\>

##### mode?

`"build"` \| `"submit"`

#### Returns

`Promise`\<`unknown`\>

***

### signData()

> **signData**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

###### inputAddresses

`string`[]

###### inputIndices?

`number`[]

###### returnFormat?

`string`

###### unsignedHex

`string`

#### Returns

`Promise`\<`unknown`\>

[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / SupportProbe

# Interface: SupportProbe

Per-method capability declaration (RFC-014 Amendment A).

Port presence is not capability: a port may exist but return UNSUPPORTED for a
method (e.g. the Omnia relay client's advanced topology ops). A port implements
`supports()` to report what it will actually attempt, so the manifest and the
live dispatch describe reality rather than the port's existence. Absent ⇒ the
method is assumed supported (pre-amendment behaviour).

## Extended by

- [`WalletSignerPort`](WalletSignerPort.md)
- [`ChainStateProviderPort`](ChainStateProviderPort.md)
- [`WotsLeasePort`](WotsLeasePort.md)
- [`StatechainClientPort`](StatechainClientPort.md)
- [`OmniaClientPort`](OmniaClientPort.md)
- [`KissvmClientPort`](KissvmClientPort.md)
- [`AgentBridgePort`](AgentBridgePort.md)
- [`ReceiptStorePort`](ReceiptStorePort.md)
- [`PaymentRequestPort`](PaymentRequestPort.md)
- [`SelfHostedPort`](SelfHostedPort.md)

## Methods

### supports()?

> `optional` **supports**(`method`): `boolean` \| \{ `reason?`: `string`; `supported`: `boolean`; \}

#### Parameters

##### method

`string`

#### Returns

`boolean` \| \{ `reason?`: `string`; `supported`: `boolean`; \}

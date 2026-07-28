[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildPaymentChannelScript

# Function: buildPaymentChannelScript()

> **buildPaymentChannelScript**(`config`): `string`

Build a KISSVM policy script for sequence-numbered channel state
transitions. This function does NOT independently implement the full
Omnia latest-state-wins (Eltoo/LN-Symmetry) protocol.

The script:
  1. Reads previous sequence from PREVSTATE
  2. Validates new sequence > previous sequence
  3. Verifies MULTISIG(2) from both parties
  4. If settlement flag is set, verifies settlement conditions
  5. Delegates to policy root for governance rules

## Parameters

### config

[`PaymentChannelConfig`](../interfaces/PaymentChannelConfig.md)

## Returns

`string`

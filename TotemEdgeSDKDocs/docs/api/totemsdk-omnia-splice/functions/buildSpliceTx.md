[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / buildSpliceTx

# Function: buildSpliceTx()

> **buildSpliceTx**(`channel`, `params`): [`SpliceTxDraft`](../interfaces/SpliceTxDraft.md)

Build a validated SpliceTxDraft from channel + splice params.

For splice-in:
  inputs  = [channel coin (latestCoinId), additional coin]
  outputs = [new channel coin at fundingAddress, sequence=0, settlement=false]

For splice-out:
  inputs  = [channel coin (latestCoinId)]
  outputs = [new channel coin at fundingAddress, sequence=0, settlement=false]
            [withdrawal coin at withdrawAddress]
            [any extra outputs]

The output channel coin always resets STATE(101)=0 so the new channel starts
from sequence 0 with a full WOTS signing budget.

## Parameters

### channel

`OmniaChannel`

Quiesced or active channel to splice.

### params

[`SpliceParams`](../interfaces/SpliceParams.md)

Splice parameters (type, amounts, addresses).

## Returns

[`SpliceTxDraft`](../interfaces/SpliceTxDraft.md)

Validated SpliceTxDraft.

## Throws

If output amounts do not sum to newTotalValue.

## Throws

If splice-out exceeds channel holdings.

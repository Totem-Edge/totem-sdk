[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / executeIntent

# Function: executeIntent()

> **executeIntent**(`channel`, `intent`, `policy`, `leaseProvider`, `signer?`, `options?`): `Promise`\<[`IntentResult`](../interfaces/IntentResult.md)\>

Agent entry point for channel payment execution.

Spec: `executeIntent(channel, intent, policy, leaseProvider)` — signer is optional
and falls back to `channel.localSigner`.

Evaluates `policy.canAutoApprove(proposal)`. If approved, calls `updateState` and
returns an `AgentReceipt`. If approval is required, returns `{ status: 'pending_user' }`
without signing.

`canAutoApprove` is the primary and only gate — no bypass path exists. When the
policy implements the reservation lifecycle, quota is reserved immediately before
execution, committed on success, and released on any non-success path. Stateful
policies are never mutated by the read-only `canAutoApprove` check.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### intent

[`PaymentIntent`](../interfaces/PaymentIntent.md)

### policy

[`AgentPolicy`](../interfaces/AgentPolicy.md)

### leaseProvider

`WotsLeaseProvider`

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

### options?

`ExecuteIntentOptions`

## Returns

`Promise`\<[`IntentResult`](../interfaces/IntentResult.md)\>

[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / canonicalAgentActionDigest

# Function: canonicalAgentActionDigest()

> **canonicalAgentActionDigest**(`action`): `string`

Canonical digest of a prepared operation's SECURITY FACTS: the action, the
verified effects (spends/fees/channels/state), and the run+step binding.
Agent-supplied hints are excluded. A step that changes any effect or its
run/step identity is a different operation.

## Parameters

### action

[`CanonicalAgentAction`](../interfaces/CanonicalAgentAction.md)

## Returns

`string`

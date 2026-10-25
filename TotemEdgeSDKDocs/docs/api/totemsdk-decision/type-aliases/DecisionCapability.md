[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionCapability

# Type Alias: DecisionCapability

> **DecisionCapability** = `"decision:choice"` \| `"decision:score"` \| `"decision:probability"` \| `"decision:action"`

Closed set of canonical decision capabilities (RFC-012 §4.2).

v1 keeps this closed — there is no `decision:${string}` extension. The
provider vocabulary and the Edge capability vocabulary are identical, so an
adapter can never advertise a capability Edge cannot grant. Widen both
together when a fifth semantic type genuinely exists.

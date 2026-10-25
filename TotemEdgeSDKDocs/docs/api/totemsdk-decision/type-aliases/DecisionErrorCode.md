[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionErrorCode

# Type Alias: DecisionErrorCode

> **DecisionErrorCode** = `"NOT_IMPLEMENTED"` \| `"INVALID_REQUEST"` \| `"INVALID_OUTPUT"` \| `"INVALID_CANDIDATE"` \| `"DUPLICATE_CANDIDATE"` \| `"EMPTY_CANDIDATE_SET"` \| `"NON_FINITE_NUMBER"` \| `"INVALID_DISTRIBUTION"` \| `"LIMIT_EXCEEDED"` \| `"NO_ACCEPTABLE_RESULT"` \| `"UNAVAILABLE"` \| `"TIMEOUT"` \| `"CANCELLED"` \| `"PROVIDER_ERROR"` \| `"STALE_DECISION"` \| `"DUPLICATE_REQUEST_ID"` \| `"INTERNAL"`

Error codes shared across the decision surface.

`NO_ACCEPTABLE_RESULT` is the terminal outcome when every route is skipped,
rejected, or fails.

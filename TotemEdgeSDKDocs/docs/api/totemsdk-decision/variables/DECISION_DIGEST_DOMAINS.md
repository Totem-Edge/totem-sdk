[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DECISION\_DIGEST\_DOMAINS

# Variable: DECISION\_DIGEST\_DOMAINS

> `const` **DECISION\_DIGEST\_DOMAINS**: `object`

Domain separation prefixes for canonical digests. Never hash ambiguous
string concatenations — always go through `hashCanonical(domain, value)`.

## Type Declaration

### candidates

> `readonly` **candidates**: `"TOTEM_DECISION_CANDIDATES_V1"` = `'TOTEM_DECISION_CANDIDATES_V1'`

### output

> `readonly` **output**: `"TOTEM_DECISION_OUTPUT_V1"` = `'TOTEM_DECISION_OUTPUT_V1'`

### receipt

> `readonly` **receipt**: `"TOTEM_DECISION_RECEIPT_V1"` = `'TOTEM_DECISION_RECEIPT_V1'`

### request

> `readonly` **request**: `"TOTEM_DECISION_REQUEST_V1"` = `'TOTEM_DECISION_REQUEST_V1'`

### state

> `readonly` **state**: `"TOTEM_DECISION_STATE_V1"` = `'TOTEM_DECISION_STATE_V1'`

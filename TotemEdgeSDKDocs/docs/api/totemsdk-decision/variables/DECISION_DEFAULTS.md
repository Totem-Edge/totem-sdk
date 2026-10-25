[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DECISION\_DEFAULTS

# Variable: DECISION\_DEFAULTS

> `const` **DECISION\_DEFAULTS**: `object`

Default runtime limits. Missing limits are omitted, never invented.

## Type Declaration

### argmaxTolerance

> `readonly` **argmaxTolerance**: `0.000001` = `1e-6`

Numeric slack when asserting the selected candidate is the distribution argmax.

### distributionTolerance

> `readonly` **distributionTolerance**: `0.000001` = `1e-6`

Fractional tolerance when validating a complete distribution sums to 1.

### maxCandidatesPerQuestion

> `readonly` **maxCandidatesPerQuestion**: `256` = `256`

Maximum candidates for any single choice/score question.

### maxOperations

> `readonly` **maxOperations**: `256` = `256`

Maximum operations in an action request.

### maxQuestions

> `readonly` **maxQuestions**: `64` = `64`

Maximum questions in a batched questions request.

### maxStateBytes

> `readonly` **maxStateBytes**: `number`

Maximum canonical state size in bytes.

### maxTargetsPerOperation

> `readonly` **maxTargetsPerOperation**: `64` = `64`

Maximum targets per operation.

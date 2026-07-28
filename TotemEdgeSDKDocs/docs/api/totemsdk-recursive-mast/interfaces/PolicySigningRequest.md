[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / PolicySigningRequest

# Interface: PolicySigningRequest

## Properties

### action

> **action**: `string`

The action being executed.

***

### disclosedScripts

> **disclosedScripts**: [`ScriptDisclosure`](ScriptDisclosure.md)[]

Disclosed scripts for verification.

***

### evidence

> **evidence**: [`SignedEvidence`](SignedEvidence.md)[]

Supporting evidence.

***

### expectedInputs

> **expectedInputs**: [`ExpectedInput`](ExpectedInput.md)[]

Expected inputs.

***

### expectedOutputs

> **expectedOutputs**: [`ExpectedOutput`](ExpectedOutput.md)[]

Expected outputs.

***

### expiresAt

> **expiresAt**: `number`

When the request expires.

***

### policyEpoch

> **policyEpoch**: `number`

Current policy epoch.

***

### policyId

> **policyId**: `string`

The policy manifest ID.

***

### policyVersion

> **policyVersion**: `number`

Policy version.

***

### replyEndpoint

> **replyEndpoint**: `string`

Where to send the response.

***

### requestedAt

> **requestedAt**: `number`

When the request was created.

***

### requestedRole

> **requestedRole**: `string`

The role being requested to sign.

***

### requesterIdentity

> **requesterIdentity**: [`SignedIdentityClaim`](SignedIdentityClaim.md)

The requester's identity claim.

***

### requesterSignature

> **requesterSignature**: `string`

The requester's signature over the request.

***

### requestId

> **requestId**: `string`

Unique request identifier.

***

### selectedPath

> **selectedPath**: [`PolicyPathDescriptor`](PolicyPathDescriptor.md)

The policy path from anchor to action.

***

### subjectId

> **subjectId**: `string`

The subject being acted upon.

***

### transactionDigest

> **transactionDigest**: `string`

The canonical transaction digest to sign.

***

### transactionTemplate

> **transactionTemplate**: `Uint8Array`

The transaction template (serialised Minima TX).

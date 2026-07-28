[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildStandardCompliancePipeline

# Function: buildStandardCompliancePipeline()

> **buildStandardCompliancePipeline**(`schemaPolicyRoot`, `issuerPolicyRoot`, `revocationPolicyRoot`, `attributePolicyRoot`, `schemaProof`, `issuerProof`, `revocationProof`, `attributeProof`): [`ProofChain`](../interfaces/ProofChain.md)

Build a standard 4-stage compliance pipeline:
  1. Schema validation — is the data well-formed?
  2. Issuer verification — is the issuer authorized?
  3. Revocation check — has the credential been revoked?
  4. Attribute proof — does the attribute satisfy the policy?

## Parameters

### schemaPolicyRoot

`string`

### issuerPolicyRoot

`string`

### revocationPolicyRoot

`string`

### attributePolicyRoot

`string`

### schemaProof

`string`

### issuerProof

`string`

### revocationProof

`string`

### attributeProof

`string`

## Returns

[`ProofChain`](../interfaces/ProofChain.md)

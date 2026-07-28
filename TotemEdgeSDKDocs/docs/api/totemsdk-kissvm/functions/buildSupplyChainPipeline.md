[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildSupplyChainPipeline

# Function: buildSupplyChainPipeline()

> **buildSupplyChainPipeline**(`originRoot`, `transportRoot`, `qualityRoot`, `customsRoot`, `originProof`, `transportProof`, `qualityProof`, `customsProof`): [`ProofChain`](../interfaces/ProofChain.md)

Build a supply chain verification pipeline:
  1. Origin verification — where was it produced?
  2. Transport verification — how was it shipped?
  3. Quality verification — does it meet standards?
  4. Customs verification — has it cleared customs?

## Parameters

### originRoot

`string`

### transportRoot

`string`

### qualityRoot

`string`

### customsRoot

`string`

### originProof

`string`

### transportProof

`string`

### qualityProof

`string`

### customsProof

`string`

## Returns

[`ProofChain`](../interfaces/ProofChain.md)

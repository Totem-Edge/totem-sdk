/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Compliance Pipeline Template — multi-stage verification pipeline.
 *
 * Use case: regulatory compliance, supply chain verification, identity verification
 *
 * Workflow:
 *   Schema validation → Issuer verification → Revocation check → Attribute proof
 *
 * Each stage is a separate policy root. The pipeline chains them via
 * recursive MAST: each stage proves the next stage's script is authorized.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyTree } from '../types.js';
import { buildPolicyTree, type PolicyNodeInput } from '../policy-tree.js';
import { buildProofChain, type ProofLink } from '../proof-chain.js';

export interface ComplianceStage {
  /** Stage identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** The KISSVM script for this stage. */
  script: string;
  /** The policy root that authorizes this stage. */
  policyRoot: string;
  /** Merkle proof that this stage's script is in the policy root. */
  proof: string;
}

export interface CompliancePipelineConfig {
  /** Pipeline identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Ordered list of compliance stages. */
  stages: ComplianceStage[];
}

/**
 * Build a compliance pipeline as a proof chain.
 * Each stage verifies one aspect of compliance and delegates to the next.
 */
export function buildCompliancePipeline(config: CompliancePipelineConfig): ReturnType<typeof buildProofChain> {
  const links: ProofLink[] = config.stages.map((stage, i) => ({
    scriptHash: bytesToHex(sha3_256(new TextEncoder().encode(stage.script))),
    policyRoot: stage.policyRoot,
    proof: stage.proof,
    script: stage.script,
    label: `${i}: ${stage.name}`,
  }));

  return buildProofChain(links);
}

/**
 * Build a standard 4-stage compliance pipeline:
 *   1. Schema validation — is the data well-formed?
 *   2. Issuer verification — is the issuer authorized?
 *   3. Revocation check — has the credential been revoked?
 *   4. Attribute proof — does the attribute satisfy the policy?
 */
export function buildStandardCompliancePipeline(
  schemaPolicyRoot: string,
  issuerPolicyRoot: string,
  revocationPolicyRoot: string,
  attributePolicyRoot: string,
  schemaProof: string,
  issuerProof: string,
  revocationProof: string,
  attributeProof: string,
): ReturnType<typeof buildProofChain> {
  return buildCompliancePipeline({
    id: 'standard-compliance',
    name: 'Standard Compliance Pipeline',
    stages: [
      {
        id: 'schema',
        name: 'Schema Validation',
        script: [
          `ASSERT STATE(0) EQ [application/json]`,
          `ASSERT STATE(1) EQ [TotemCredential-v1]`,
          `RETURN TRUE`,
        ].join('\n'),
        policyRoot: schemaPolicyRoot,
        proof: schemaProof,
      },
      {
        id: 'issuer',
        name: 'Issuer Verification',
        script: [
          `LET issuer = STATE(2)`,
          `ASSERT SIGNEDBY(issuer)`,
          `RETURN TRUE`,
        ].join('\n'),
        policyRoot: issuerPolicyRoot,
        proof: issuerProof,
      },
      {
        id: 'revocation',
        name: 'Revocation Check',
        script: [
          `LET credentialId = STATE(3)`,
          `ASSERT NOT CONTAINS(STATE(4) credentialId)`,
          `RETURN TRUE`,
        ].join('\n'),
        policyRoot: revocationPolicyRoot,
        proof: revocationProof,
      },
      {
        id: 'attribute',
        name: 'Attribute Proof',
        script: [
          `LET attribute = STATE(5)`,
          `LET threshold = STATE(6)`,
          `ASSERT attribute GTE threshold`,
          `RETURN TRUE`,
        ].join('\n'),
        policyRoot: attributePolicyRoot,
        proof: attributeProof,
      },
    ],
  });
}

/**
 * Build a supply chain verification pipeline:
 *   1. Origin verification — where was it produced?
 *   2. Transport verification — how was it shipped?
 *   3. Quality verification — does it meet standards?
 *   4. Customs verification — has it cleared customs?
 */
export function buildSupplyChainPipeline(
  originRoot: string,
  transportRoot: string,
  qualityRoot: string,
  customsRoot: string,
  originProof: string,
  transportProof: string,
  qualityProof: string,
  customsProof: string,
): ReturnType<typeof buildProofChain> {
  return buildCompliancePipeline({
    id: 'supply-chain',
    name: 'Supply Chain Verification Pipeline',
    stages: [
      {
        id: 'origin',
        name: 'Origin Verification',
        script: [
          `LET origin = STATE(0)`,
          `LET producer = STATE(1)`,
          `ASSERT SIGNEDBY(producer)`,
          `ASSERT origin EQ STATE(2)`,
          `RETURN TRUE`,
        ].join('\n'),
        policyRoot: originRoot,
        proof: originProof,
      },
      {
        id: 'transport',
        name: 'Transport Verification',
        script: [
          `LET carrier = STATE(3)`,
          `LET route = STATE(4)`,
          `ASSERT SIGNEDBY(carrier)`,
          `ASSERT route EQ STATE(5)`,
          `RETURN TRUE`,
        ].join('\n'),
        policyRoot: transportRoot,
        proof: transportProof,
      },
      {
        id: 'quality',
        name: 'Quality Verification',
        script: [
          `LET inspector = STATE(6)`,
          `LET grade = STATE(7)`,
          `ASSERT SIGNEDBY(inspector)`,
          `ASSERT grade GTE [A]`,
          `RETURN TRUE`,
        ].join('\n'),
        policyRoot: qualityRoot,
        proof: qualityProof,
      },
      {
        id: 'customs',
        name: 'Customs Verification',
        script: [
          `LET authority = STATE(8)`,
          `LET clearance = STATE(9)`,
          `ASSERT SIGNEDBY(authority)`,
          `ASSERT clearance EQ [APPROVED]`,
          `RETURN TRUE`,
        ].join('\n'),
        policyRoot: customsRoot,
        proof: customsProof,
      },
    ],
  });
}

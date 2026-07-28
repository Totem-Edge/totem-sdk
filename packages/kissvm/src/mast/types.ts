import type { MiniNumber } from '../MiniNumber.js';

export interface PolicyNode {
  id: string;
  name: string;
  scriptHash: string;
  script: string;
  policyRoot: string;
  children: PolicyNode[];
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface PolicyTree {
  root: PolicyNode;
  nodeMap: Map<string, PolicyNode>;
  depth: number;
  nodeCount: number;
}

export interface ProofLink {
  scriptHash: string;
  policyRoot: string;
  proof: string;
  script: string;
  leafSum?: MiniNumber;
  rootSum?: MiniNumber;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface ProofChain {
  links: ProofLink[];
  depth: number;
  verified: boolean;
  leafScriptHash: string;
}

export interface StateTransition {
  port: number;
  name: string;
  currentValue: string;
  previousValue: string;
  transition: string;
  valid: boolean;
}

export interface PrevStateWorkflow {
  id: string;
  name: string;
  transitions: StateTransition[];
  script: string;
  scriptHash: string;
}

export interface VerificationResult {
  valid: boolean;
  failedAt?: number;
  reason?: string;
  chain?: ProofChain;
}

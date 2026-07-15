#!/usr/bin/env node
/**
 * generate-proto.mjs — Generate language bindings from agent_policy.proto
 *
 * Outputs:
 *   src/generated/agent_policy.ts    — TypeScript types (protobuf-ts)
 *   src/generated/agent_policy_pb.py — Python types (protoc)
 *
 * Run: node scripts/generate-proto.mjs
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
const PROTO_DIR = join(PKG_ROOT, 'proto');
const GEN_DIR = join(PKG_ROOT, 'src', 'generated');
const PROTO_FILE = join(PROTO_DIR, 'totem', 'agent', 'policy', 'v1', 'agent_policy.proto');

if (!existsSync(PROTO_FILE)) {
  console.error(`[generate-proto] ERROR: proto file not found: ${PROTO_FILE}`);
  process.exit(1);
}

// Clear and recreate output directory
if (existsSync(GEN_DIR)) rmSync(GEN_DIR, { recursive: true, force: true });
mkdirSync(GEN_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// 1. TypeScript (protobuf-ts)
// ---------------------------------------------------------------------------
console.log('[generate-proto] Generating TypeScript types...');
try {
  execSync(
    `npx protoc \
      --ts_out ${GEN_DIR} \
      --ts_opt generate_dependencies,long_type_string,output_typescript \
      --proto_path ${PROTO_DIR} \
      --proto_path ${join(PKG_ROOT, 'node_modules', '@protobuf-ts', 'plugin', 'node_modules', '.proto-include') || PROTO_DIR} \
      ${PROTO_FILE}`,
    { cwd: PKG_ROOT, stdio: 'pipe' }
  );
  console.log('[generate-proto]   ✓ TypeScript types generated');
} catch (err) {
  // protobuf-ts may not be installed yet — write a stub
  console.warn('[generate-proto]   ⚠ protobuf-ts not available, writing stub');
  writeTsStub();
}

// ---------------------------------------------------------------------------
// 2. Python (protoc --python_out)
// ---------------------------------------------------------------------------
console.log('[generate-proto] Generating Python types...');
try {
  execSync(
    `protoc \
      --python_out ${GEN_DIR} \
      --proto_path ${PROTO_DIR} \
      ${PROTO_FILE}`,
    { cwd: PKG_ROOT, stdio: 'pipe' }
  );
  console.log('[generate-proto]   ✓ Python types generated');
} catch (err) {
  console.warn('[generate-proto]   ⚠ protoc not available for Python, skipping');
}

console.log('[generate-proto] Done.');

// ---------------------------------------------------------------------------
// Stub: write TypeScript types manually when protobuf-ts is unavailable
// ---------------------------------------------------------------------------
function writeTsStub() {
  const stub = `// Auto-generated stub — install @protobuf-ts/plugin and re-run generate:proto
// for full protobuf-ts output.

export enum IntentType {
  UNSPECIFIED = 0,
  PAYMENT = 1,
  CHANNEL_UPDATE = 2,
  SETTLEMENT = 3,
  LOOKUP = 4,
  RECEIPT = 5,
}

export enum RiskLevel {
  UNSPECIFIED = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
}

export enum ReceiptStatus {
  UNSPECIFIED = 0,
  APPROVED = 1,
  REJECTED = 2,
  PENDING_USER = 3,
}

export interface PaymentIntent {
  type: IntentType;
  amount: string;
  tokenId: string;
  recipient: string;
  reason: string;
  risk: RiskLevel;
  metadata?: Record<string, unknown>;
}

export interface AgentProposal {
  id: string;
  agentId: string;
  intent: PaymentIntent;
  explanation: string;
  confidence: number;
  createdAt: string;
}

export interface AgentReceipt {
  proposalId: string;
  status: ReceiptStatus;
  txpowId: string;
  channelState: string;
  rejectionReason: string;
  settledAt: string;
}

export interface AgentIdentity {
  agentId: string;
  address: string;
  capabilities: string[];
}

export interface AgentPolicyConfig {
  agentId: string;
  allowedIntents: IntentType[];
  limits: Record<string, string>;
  expiresAt: string;
}
`;
  mkdirSync(GEN_DIR, { recursive: true });
  writeFileSync(join(GEN_DIR, 'agent_policy.ts'), stub);
}

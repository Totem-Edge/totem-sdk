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
import { existsSync, mkdirSync, renameSync, rmSync } from 'fs';
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

// ---------------------------------------------------------------------------
// 1. TypeScript (protobuf-ts)
// ---------------------------------------------------------------------------
console.log('[generate-proto] Generating TypeScript types...');
const TS_GEN_DIR = `${GEN_DIR}.tmp`;
try {
  if (existsSync(TS_GEN_DIR)) rmSync(TS_GEN_DIR, { recursive: true, force: true });
  mkdirSync(TS_GEN_DIR, { recursive: true });
  const plugin = join(PKG_ROOT, 'node_modules', '.bin', 'protoc-gen-ts');
  if (!existsSync(plugin)) throw new Error('protoc-gen-ts is not installed');
  execSync(
    `${join(PKG_ROOT, 'node_modules', '.bin', 'protoc')} \
      --ts_out ${TS_GEN_DIR} \
      --ts_opt generate_dependencies,long_type_string,output_typescript \
      --proto_path ${PROTO_DIR} \
      --proto_path ${join(PKG_ROOT, 'node_modules', '@protobuf-ts', 'plugin', 'node_modules', '.proto-include')} \
      ${PROTO_FILE}`,
    { cwd: PKG_ROOT, stdio: 'pipe', env: { ...process.env, PATH: `${join(PKG_ROOT, 'node_modules', '.bin')}:${process.env.PATH ?? ''}` } }
  );
  if (existsSync(GEN_DIR)) rmSync(GEN_DIR, { recursive: true, force: true });
  renameSync(TS_GEN_DIR, GEN_DIR);
  console.log('[generate-proto]   ✓ TypeScript types generated');
} catch (err) {
  if (existsSync(TS_GEN_DIR)) rmSync(TS_GEN_DIR, { recursive: true, force: true });
  if (existsSync(join(GEN_DIR, 'totem', 'agent', 'policy', 'v1', 'agent_policy.ts'))) {
    console.warn('[generate-proto]   ! protobuf-ts unavailable; preserving checked-in TypeScript bindings');
  } else {
    console.error('[generate-proto] ERROR: protobuf-ts TypeScript generation failed');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 2. Python (protoc --python_out)
// ---------------------------------------------------------------------------
console.log('[generate-proto] Generating Python types...');
try {
  mkdirSync(GEN_DIR, { recursive: true });
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

/**
 * edge/actions.ts — Built-in Edge action definitions.
 *
 * Canonical action namespaces for every agent-accessible operation. Each
 * definition derives canonical effects from the REAL prepared operation, never
 * from agent-supplied hints. Ports are only reachable through these
 * definitions — the agent never holds a raw port handle.
 */

import type { EdgeActionDefinition, EdgeActionInput } from './action-registry.js';
import type { EdgeCapability } from './capabilities.js';
import type { EdgeRuntimePorts } from './ports.js';
import type { EdgeOperationResult } from './types.js';
import type { StepEffects } from '@totemsdk/agent-policy';

function noEffects(): StepEffects {
  return { spends: [], fees: [], channels: [] };
}

export interface BuiltinActionRegistration {
  action: string;
  def: EdgeActionDefinition;
}

export function createBuiltinActionDefinitions(
  ports: EdgeRuntimePorts,
  trusted?: { manifestSeed?: Uint8Array; manifestKeyIndex?: number },
): BuiltinActionRegistration[] {
  const defs: BuiltinActionRegistration[] = [];

  // ── Payments ─────────────────────────────────────────────────────────────
  defs.push({
    action: 'payment:send',
    def: {
      capability: 'payment:send',
      effect: 'spend',
      prepare: (input) => ({
        recipient: input.subject,
        amount: String(input.payload?.amount ?? '0'),
        tokenId: input.payload?.tokenId as string | undefined,
        memo: input.payload?.memo as string | undefined,
      }),
      deriveEffects: (prepared) => {
        const p = prepared as { recipient: string; amount: string; tokenId?: string };
        return { spends: [{ tokenId: p.tokenId ?? '0x00', amount: p.amount, recipient: p.recipient }], fees: [], channels: [] };
      },
      execute: async (prepared) => {
        if (!ports.payment) return { ok: false, error: 'No payment port configured', errorCode: 'PORT_MISSING' };
        return ports.payment.pay(prepared as never);
      },
    },
  });

  // ── Omnia ─────────────────────────────────────────────────────────────────
  const omniaOps: Array<{ action: string; capability: EdgeCapability; op: string; effect: EdgeActionDefinition['effect'] }> = [
    { action: 'omnia:channel:open', capability: 'omnia:channels', op: 'openChannel', effect: 'write' },
    { action: 'omnia:pay', capability: 'omnia:routing', op: 'pay', effect: 'spend' },
    { action: 'omnia:settle', capability: 'omnia:channels', op: 'settle', effect: 'spend' },
    { action: 'omnia:close', capability: 'omnia:channels', op: 'closeChannel', effect: 'write' },
    { action: 'omnia:route', capability: 'omnia:routing', op: 'getRoute', effect: 'read' },
    { action: 'omnia:pay-multihop', capability: 'omnia:multi-hop', op: 'payMultiHop', effect: 'spend' },
    { action: 'omnia:swap-rate', capability: 'omnia:cross-token-swap', op: 'getSwapRate', effect: 'read' },
    { action: 'omnia:factory:create', capability: 'omnia:factory', op: 'createFactory', effect: 'write' },
    { action: 'omnia:virtual:open', capability: 'omnia:virtual-channels', op: 'openVirtualChannel', effect: 'write' },
    { action: 'omnia:factory:close', capability: 'omnia:factory', op: 'closeFactory', effect: 'write' },
    { action: 'omnia:splice-in', capability: 'omnia:splicing', op: 'spliceIn', effect: 'write' },
    { action: 'omnia:splice-out', capability: 'omnia:splicing', op: 'spliceOut', effect: 'spend' },
  ];
  for (const o of omniaOps) {
    defs.push({
      action: o.action,
      def: {
        capability: o.capability,
        effect: o.effect,
        prepare: (input) => ({ subject: input.subject, ...(input.payload ?? {}) }),
        deriveEffects: (prepared) => {
          const p = prepared as { subject: string; amount?: string; tokenId?: string; channelId?: string };
          const effects: StepEffects = { spends: [], fees: [], channels: [] };
          if (o.effect === 'spend' && p.amount) {
            effects.spends = [{ tokenId: p.tokenId ?? '0x00', amount: String(p.amount), recipient: p.subject }];
          }
          if (p.channelId) {
            effects.channels = [{ channelId: p.channelId, operation: o.op }];
          }
          return effects;
        },
        execute: async (prepared) => {
          if (!ports.omnia) return { ok: false, error: 'No Omnia port configured', errorCode: 'PORT_MISSING' };
          const fn = (ports.omnia as unknown as Record<string, (p: Record<string, unknown>) => Promise<EdgeOperationResult>>)[o.op];
          if (!fn) return { ok: false, error: `Unknown Omnia operation: ${o.op}`, errorCode: 'UNKNOWN_ACTION' };
          return fn(prepared as Record<string, unknown>);
        },
      },
    });
  }

  // ── Proofs ────────────────────────────────────────────────────────────────
  defs.push({
    action: 'proof:create',
    def: {
      capability: 'proof:create',
      effect: 'write',
      prepare: (input) => ({ subject: input.subject, claims: input.payload?.claims ?? [], context: input.context }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.proof) return { ok: false, error: 'No proof port configured', errorCode: 'PORT_MISSING' };
        return ports.proof.createProof(prepared as never);
      },
    },
  });
  defs.push({
    action: 'proof:verify',
    def: {
      capability: 'proof:verify',
      effect: 'read',
      prepare: (input) => ({ proof: input.payload?.proof, subject: input.subject }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.proof) return { ok: false, error: 'No proof port configured', errorCode: 'PORT_MISSING' };
        return ports.proof.verifyProof(prepared as never);
      },
    },
  });

  // ── Lookup ───────────────────────────────────────────────────────────────
  defs.push({
    action: 'lookup:query',
    def: {
      capability: 'lookup:watch',
      effect: 'read',
      prepare: (input) => ({ query: input.subject }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.lookup) return { ok: false, error: 'No lookup port configured', errorCode: 'PORT_MISSING' };
        return ports.lookup.lookup(prepared as never);
      },
    },
  });
  defs.push({
    action: 'lookup:announce',
    def: {
      capability: 'lookup:watch',
      effect: 'publish',
      prepare: (input) => input.payload ?? {},
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.lookup) return { ok: false, error: 'No lookup port configured', errorCode: 'PORT_MISSING' };
        return ports.lookup.announce(prepared as never);
      },
    },
  });

  // ── Location ─────────────────────────────────────────────────────────────
  defs.push({
    action: 'location:claim:create',
    def: {
      capability: 'location:claim',
      effect: 'write',
      prepare: (input) => ({ subjectId: input.subject, deviceId: input.context?.deviceId ?? '', ...(input.payload ?? {}) }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.location) return { ok: false, error: 'No location port configured', errorCode: 'PORT_MISSING' };
        return ports.location.createClaim(prepared as never);
      },
    },
  });
  defs.push({
    action: 'location:trail:create',
    def: {
      capability: 'location:trail',
      effect: 'write',
      prepare: (input) => ({ subjectId: input.subject, deviceId: input.context?.deviceId ?? '', ...(input.payload ?? {}) }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.location) return { ok: false, error: 'No location port configured', errorCode: 'PORT_MISSING' };
        return ports.location.createTrail(prepared as never);
      },
    },
  });
  defs.push({
    action: 'location:proof:create',
    def: {
      capability: 'location:proof',
      effect: 'write',
      prepare: (input) => ({ claim: input.payload?.claim, context: input.context }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.location) return { ok: false, error: 'No location port configured', errorCode: 'PORT_MISSING' };
        return ports.location.createProof(prepared as never);
      },
    },
  });

  // ── Identity ─────────────────────────────────────────────────────────────
  defs.push({
    action: 'identity:resolve',
    def: {
      capability: 'identity:resolve',
      effect: 'read',
      prepare: (input) => ({ identityId: input.subject }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.identity) return { ok: false, error: 'No identity port configured', errorCode: 'PORT_MISSING' };
        return ports.identity.resolve((prepared as { identityId: string }).identityId);
      },
    },
  });
  defs.push({
    action: 'identity:verify',
    def: {
      capability: 'identity:resolve',
      effect: 'read',
      prepare: (input) => ({ proof: input.payload?.proof }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.identity) return { ok: false, error: 'No identity port configured', errorCode: 'PORT_MISSING' };
        return ports.identity.verify((prepared as { proof: unknown }).proof);
      },
    },
  });

  // ── Manifests ─────────────────────────────────────────────────────────────
  defs.push({
    action: 'manifest:sign',
    def: {
      capability: 'manifest:sign',
      effect: 'sign',
      prepare: (input) => ({ manifest: input.payload?.manifest }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.manifest) return { ok: false, error: 'No manifest port configured', errorCode: 'PORT_MISSING' };
        // The agent never supplies a seed — signing uses the trusted wallet key.
        if (!trusted?.manifestSeed) return { ok: false, error: 'No trusted manifest signing key configured', errorCode: 'SIGNING_KEY_MISSING' };
        return ports.manifest.sign(
          (prepared as { manifest: unknown }).manifest,
          trusted.manifestSeed,
          trusted.manifestKeyIndex ?? 0,
        );
      },
    },
  });
  defs.push({
    action: 'manifest:verify',
    def: {
      capability: 'manifest:verify',
      effect: 'read',
      prepare: (input) => ({ signed: input.payload?.signed }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.manifest) return { ok: false, error: 'No manifest port configured', errorCode: 'PORT_MISSING' };
        return ports.manifest.verify((prepared as { signed: unknown }).signed);
      },
    },
  });

  // ── Liquidity ────────────────────────────────────────────────────────────
  defs.push({
    action: 'liquidity:balance:read',
    def: {
      capability: 'payment:send',
      effect: 'read',
      prepare: (input) => ({ address: input.subject }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.liquidity) return { ok: false, error: 'No liquidity port configured', errorCode: 'PORT_MISSING' };
        return ports.liquidity.getBalance((prepared as { address: string }).address);
      },
    },
  });
  defs.push({
    action: 'liquidity:utxo:read',
    def: {
      capability: 'payment:send',
      effect: 'read',
      prepare: (input) => ({ address: input.subject }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.liquidity) return { ok: false, error: 'No liquidity port configured', errorCode: 'PORT_MISSING' };
        return ports.liquidity.getUtxos((prepared as { address: string }).address);
      },
    },
  });

  // ── Transport: pub/sub ────────────────────────────────────────────────────
  defs.push({
    action: 'transport:publish',
    def: {
      capability: 'transport:pubsub',
      effect: 'publish',
      prepare: (input) => ({ topic: input.payload?.topic ?? '', payload: input.payload?.message ?? '' }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.pubsub) return { ok: false, error: 'No pubsub port configured', errorCode: 'PORT_MISSING' };
        const p = prepared as { topic: string; payload: string | Uint8Array };
        await ports.pubsub.publish(p.topic, p.payload);
        return { ok: true };
      },
    },
  });
  defs.push({
    action: 'transport:subscribe',
    def: {
      capability: 'transport:pubsub',
      effect: 'read',
      prepare: (input) => ({ topic: input.payload?.topic ?? '' }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.pubsub) return { ok: false, error: 'No pubsub port configured', errorCode: 'PORT_MISSING' };
        const p = prepared as { topic: string };
        const sub = await ports.pubsub.subscribe(p.topic);
        return { ok: true, data: { topic: p.topic, unsubscribe: sub.unsubscribe } };
      },
    },
  });

  // ── Transport: streams ───────────────────────────────────────────────────
  defs.push({
    action: 'transport:send',
    def: {
      capability: 'transport:stream',
      effect: 'write',
      prepare: (input) => ({ data: input.payload?.data }),
      deriveEffects: noEffects,
      execute: async (prepared) => {
        if (!ports.stream) return { ok: false, error: 'No stream port configured', errorCode: 'PORT_MISSING' };
        const p = prepared as { data: Uint8Array };
        ports.stream.send(p.data);
        return { ok: true };
      },
    },
  });

  return defs;
}

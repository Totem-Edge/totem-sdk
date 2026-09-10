import {
  DEFAULT_REGISTRY_ROOT_DOMAIN,
  applyRegistryTransition,
  computeRegistryRoot,
  registryRootPayload,
  registryRootPort,
  registerPoolWriter,
  serializeRegistryState,
  signRegistryTransition,
  verifyRegistryRoot,
  verifyRegistryTransition,
  type RegistryOperation,
  type RegistryRootVerifier,
  type RegistrySignedTransition,
  type RegistryTransitionSigner,
} from '../root.js';
import { createEmptyLiquidityBondRegistryState, registerLiquidityPool } from '../registry.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';
import type { LiquidityBondRegistryState } from '../types.js';

function makePool(id = 'pool-1') {
  return createLiquidityPoolManifest({
    poolId: id, poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, createdAt: 1000,
  });
}

function makeSigner(pk = 'rooter-1', sig = new Uint8Array([1, 2, 3])): RegistryTransitionSigner {
  return {
    publicKeyDigest: pk,
    sign: jest.fn(async (_payload: Uint8Array, _indices) => sig),
  };
}

function makeVerifier(signer: RegistryTransitionSigner): RegistryRootVerifier {
  return {
    publicKeyDigest: signer.publicKeyDigest,
    verify: jest.fn(async (payload, signature) => {
      const r = await signer.sign(payload as Uint8Array, { addressIndex: 0, l1: 0, l2: 0 });
      return (r as Uint8Array).every((b, i) => (signature as Uint8Array)[i] === b);
    }),
  };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

describe('registry rooting', () => {
  describe('serializeRegistryState', () => {
    it('excludes the volatile updatedAt and anchor root stamps', () => {
      const a = createEmptyLiquidityBondRegistryState();
      a.updatedAt = 111;
      a.root = '0xROOT1';
      const b = createEmptyLiquidityBondRegistryState();
      b.updatedAt = 999;
      b.root = '0xROOT2';
      expect(serializeRegistryState(a)).toBe(serializeRegistryState(b));
      expect(JSON.parse(serializeRegistryState(a)).updatedAt).toBeUndefined();
      expect(JSON.parse(serializeRegistryState(a)).root).toBeUndefined();
    });

    it('is deterministic for identical content', () => {
      const a = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      const b = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      expect(serializeRegistryState(a)).toBe(serializeRegistryState(b));
    });
  });

  describe('computeRegistryRoot', () => {
    it('commits to registry content and is pure', () => {
      const a = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      const b = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      expect(computeRegistryRoot(a)).toBe(computeRegistryRoot(b));
    });

    it('changes when content changes', () => {
      const a = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      const b = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p2'));
      expect(computeRegistryRoot(a)).not.toBe(computeRegistryRoot(b));
    });

    it('is unaffected by updatedAt/root and scopes changes by domain', () => {
      let a = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      let b = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      a.updatedAt = 1;
      a.root = '0xROOT1';
      b.updatedAt = 2;
      b.root = '0xROOT2';
      expect(computeRegistryRoot(a)).toBe(computeRegistryRoot(b));
      expect(computeRegistryRoot(a, { domain: 'other-domain' })).not.toBe(computeRegistryRoot(a));
    });
  });

  describe('signRegistryTransition', () => {
    it('produces a signed transition bound to the state, op, and previous root', async () => {
      const registry = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      const signer = makeSigner();
      const op: RegistryOperation = { type: 'register-pool', poolId: 'p1' };
      const previousRoot = computeRegistryRoot(registry, { domain: 'genesis' });

      const signed: RegistrySignedTransition = await signRegistryTransition(
        registry,
        op,
        signer,
        { previousRoot, reason: 'pool join', signedAt: 42, signIndices: { addressIndex: 2, l1: 1, l2: 0 } },
      );

      expect(signed.signerPublicKey).toBe('rooter-1');
      expect(signed.signedAt).toBe(42);
      expect(signed.root).toBe(computeRegistryRoot(registry));
      expect(signed.delta.previousRoot).toBe(previousRoot);
      expect(signed.delta.reason).toBe('pool join');
      expect(signed.signature).toEqual(new Uint8Array([1, 2, 3]));
      expect(signer.sign).toHaveBeenCalledWith(
        registryRootPayload(signed.root, {}),
        { addressIndex: 2, l1: 1, l2: 0 },
      );
      expect(signed.delta.opHash).toBeDefined();
    });

    it('chains from a prior root through previousRoot', async () => {
      let registry = createEmptyLiquidityBondRegistryState();
      const signer = makeSigner();
      const first = await signRegistryTransition(registry, { type: 'genesis' }, signer, { signedAt: 1 });
      registry = registerLiquidityPool(registry, makePool('p1'));
      const second = await signRegistryTransition(registry, { type: 'register-pool', poolId: 'p1' }, signer, {
        previousRoot: first.root,
        signedAt: 2,
      });
      expect(second.delta.previousRoot).toBe(first.root);
      const third = await signRegistryTransition(registry, { type: 'tip' }, signer, {
        previousRoot: second.root,
        signedAt: 3,
      });
      expect(third.delta.previousRoot).toBe(second.root);
    });
  });

  describe('verifyRegistryTransition', () => {
    let registry: ReturnType<typeof registerLiquidityPool>;
    let signer: RegistryTransitionSigner;

    beforeEach(async () => {
      registry = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      signer = makeSigner();
    });

    it('accepts a genuine signed transition', async () => {
      const signed = await signRegistryTransition(registry, { type: 'register-pool', poolId: 'p1' }, signer);
      const result = await verifyRegistryTransition(registry, signed, makeVerifier(signer));
      expect(result.valid).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it('rejects a root that no longer matches the state (drift) with a reason', async () => {
      const signed = await signRegistryTransition(registry, { type: 'register-pool', poolId: 'p1' }, signer);
      const drifted = registerLiquidityPool(registry, makePool('p2'));
      const result = await verifyRegistryTransition(drifted, signed, makeVerifier(signer));
      expect(result.valid).toBe(false);
      expect(result.reasons).toEqual(expect.arrayContaining(['registry root does not match the signed transition']));
    });

    it('rejects a transition signed by a different signer', async () => {
      const signed = await signRegistryTransition(registry, { type: 'register-pool', poolId: 'p1' }, signer);
      const other = makeSigner('rooter-2');
      const result = await verifyRegistryTransition(registry, signed, makeVerifier(other));
      expect(result.valid).toBe(false);
      expect(result.reasons).toEqual(expect.arrayContaining(['transition was not signed by the expected signer']));
    });

    it('rejects a tampered op (opHash binding)', async () => {
      const signed = await signRegistryTransition(registry, { type: 'register-pool', poolId: 'p1' }, signer);
      signed.delta.op = { type: 'register-pool', poolId: 'p1-changed' };
      const result = await verifyRegistryTransition(registry, signed, makeVerifier(signer));
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('operation hash does not bind to the signature');
    });

    it('rejects a bad signature via the verifier', async () => {
      const signed = await signRegistryTransition(registry, { type: 'register-pool', poolId: 'p1' }, signer);
      const forged = makeSigner(signer.publicKeyDigest, new Uint8Array([9, 9, 9]));
      const result = await verifyRegistryTransition(registry, signed, makeVerifier(forged));
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('signature is invalid');
    });
  });

  describe('applyRegistryTransition (#6 signed-mutation gate)', () => {
    async function setup() {
      let state = createEmptyLiquidityBondRegistryState();
      const signer = makeSigner();
      const verifier = makeVerifier(signer);
      const genesis = await signRegistryTransition(state, { type: 'genesis' }, signer, { signedAt: 1 });
      state = await applyRegistryTransition(state, state, genesis, verifier);
      return { state, signer, verifier };
    }

    it('applies a transition that extends the anchor and advances the root', async () => {
      const { state, signer, verifier } = await setup();
      const next: LiquidityBondRegistryState = registerLiquidityPool(state, makePool('p1'));
      const signed = await signRegistryTransition(next, { type: 'register-pool', poolId: 'p1' }, signer, {
        previousRoot: state.root,
      });
      const applied = await applyRegistryTransition(state, next, signed, verifier);
      expect(applied.root).toBe(signed.root);
      expect(Object.keys(applied.pools)).toContain('p1');
      expect(computeRegistryRoot(applied)).toBe(signed.root);
    });

    it('rejects a transition that does not extend the anchor (fork)', async () => {
      const { state, signer } = await setup();
      const next = registerLiquidityPool(state, makePool('p1'));
      const signed = await signRegistryTransition(next, { type: 'register-pool', poolId: 'p1' }, signer, {
        previousRoot: '0xFORGED_FORK_ROOT',
      });
      await expect(applyRegistryTransition(state, next, signed, makeVerifier(signer))).rejects.toThrow(/does not extend the registry anchor/);
    });

    it('rejects a fabricated registry whose root was signed over different content', async () => {
      const { state, signer, verifier } = await setup();
      const next = registerLiquidityPool(state, makePool('p1'));
      const fabricate: LiquidityBondRegistryState = registerLiquidityPool(state, makePool('p2'));
      const signed = await signRegistryTransition(next, { type: 'register-pool', poolId: 'p1' }, signer, {
        previousRoot: state.root,
      });
      await expect(applyRegistryTransition(state, fabricate, signed, verifier)).rejects.toThrow(/fails verification/);
    });

    it('rejects a transition forged by a different signer', async () => {
      const { state, verifier } = await setup();
      const next = registerLiquidityPool(state, makePool('p1'));
      const attacker = makeSigner('attacker-1', new Uint8Array([7, 7, 7]));
      const signed = await signRegistryTransition(next, { type: 'register-pool', poolId: 'p1' }, attacker, {
        previousRoot: state.root,
      });
      // The registry trusts the real operator's key; the attacker's signature
      // and key identity must both fail.
      await expect(applyRegistryTransition(state, next, signed, verifier)).rejects.toThrow(/fails verification/);
    });

    it('advances the anti-reorg sequence on each applied transition', async () => {
      const { state, signer, verifier } = await setup();
      const next = registerLiquidityPool(state, makePool('p1'));
      const signed = await signRegistryTransition(next, { type: 'register-pool', poolId: 'p1' }, signer, {
        previousRoot: state.root,
        sequence: (state.sequence ?? 0) + 1,
      });
      const applied = await applyRegistryTransition(state, next, signed, verifier);
      expect(applied.sequence).toBe((state.sequence ?? 0) + 1);
    });

    it('rejects a transition that does not advance the sequence (reorg)', async () => {
      const { state, signer, verifier } = await setup();
      const next = registerLiquidityPool(state, makePool('p1'));
      const signed = await signRegistryTransition(next, { type: 'register-pool', poolId: 'p1' }, signer, {
        previousRoot: state.root,
        sequence: state.sequence ?? 0,
      });
      await expect(applyRegistryTransition(state, next, signed, verifier)).rejects.toThrow(/does not advance the registry/);
    });

    it('enforces per-pool writers', async () => {
      const { state, signer, verifier } = await setup();
      const writers = registerPoolWriter({}, 'p1', signer.publicKeyDigest);
      const next = registerLiquidityPool(state, makePool('p1'));
      const signed = await signRegistryTransition(next, { type: 'register-pool', poolId: 'p1' }, signer, {
        previousRoot: state.root,
        sequence: (state.sequence ?? 0) + 1,
      });
      await expect(applyRegistryTransition(state, next, signed, verifier, { writers })).resolves.toBeDefined();

      // A different key cannot sign for pool-1 when pool-1's writer is registered.
      const otherWriter = makeSigner('other-writer', new Uint8Array([7, 7, 7]));
      const forged = await signRegistryTransition(next, { type: 'register-pool', poolId: 'p1' }, otherWriter, {
        previousRoot: state.root,
        sequence: (state.sequence ?? 0) + 1,
      });
      await expect(applyRegistryTransition(state, next, forged, verifier, { writers })).rejects.toThrow(/not signed by its authorized writer/);
    });
  });

  describe('verifyRegistryRoot', () => {
    it('succeeds without a verifier.verify when the root matches', async () => {
      const registry = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      await expect(verifyRegistryRoot(registry, computeRegistryRoot(registry), new Uint8Array(), { publicKeyDigest: 'x' })).resolves.toBe(true);
    });

    it('returns false for a mismatched root', async () => {
      const registry = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      await expect(verifyRegistryRoot(registry, '0xDEADBEEF', new Uint8Array(), { publicKeyDigest: 'x' })).resolves.toBe(false);
    });
  });

  describe('registryRootPort', () => {
    it('exposes all rooting primitives', () => {
      for (const fn of ['serializeRegistryState', 'computeRegistryRoot', 'signRegistryTransition', 'verifyRegistryTransition', 'applyRegistryTransition']) {
        expect(typeof (registryRootPort as never)[fn]).toBe('function');
      }
      expect(DEFAULT_REGISTRY_ROOT_DOMAIN).toMatch(/^totemsdk\/liquidity-bond\/registry\/v1$/);
    });
  });
});

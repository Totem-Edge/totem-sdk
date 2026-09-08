import {
  DEFAULT_REGISTRY_ROOT_DOMAIN,
  computeRegistryRoot,
  registryRootPayload,
  registryRootPort,
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

function makePool(id = 'pool-1') {
  return createLiquidityPoolManifest({
    poolId: id, poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, createdAt: 1000,
  });
}

function makeSigner(pk = 'rooter-1', sig = new Uint8Array([1, 2, 3])): RegistryTransitionSigner {
  return { publicKeyDigest: pk, sign: jest.fn().mockResolvedValue(sig) };
}

function makeVerifier(signer: RegistryTransitionSigner): RegistryRootVerifier {
  return {
    publicKeyDigest: signer.publicKeyDigest,
    verify: jest.fn().mockImplementation((digest, signature) => {
      const { sign } = signer;
      return sign(digest as never).then((r) => (r as Uint8Array).every((b, i) => signature[i] === b));
    }),
  };
}

describe('registry rooting', () => {
  describe('serializeRegistryState', () => {
    it('excludes the volatile updatedAt stamp', () => {
      const a = createEmptyLiquidityBondRegistryState();
      a.updatedAt = 111;
      const b = createEmptyLiquidityBondRegistryState();
      b.updatedAt = 999;
      expect(serializeRegistryState(a)).toBe(serializeRegistryState(b));
      expect(JSON.parse(serializeRegistryState(a)).updatedAt).toBeUndefined();
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

    it('is unaffected by updatedAt and scopes changes by domain', () => {
      let a = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      let b = registerLiquidityPool(createEmptyLiquidityBondRegistryState(), makePool('p1'));
      a.updatedAt = 1;
      b.updatedAt = 2;
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
        { previousRoot, reason: 'pool join', signedAt: 42 },
      );

      expect(signed.signerPublicKey).toBe('rooter-1');
      expect(signed.signedAt).toBe(42);
      expect(signed.root).toBe(computeRegistryRoot(registry));
      expect(signed.delta.previousRoot).toBe(previousRoot);
      expect(signed.delta.reason).toBe('pool join');
      expect(signed.signature).toEqual(new Uint8Array([1, 2, 3]));
      expect(signer.sign).toHaveBeenCalledWith(
        registryRootPayload(signed.root, {}),
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
      await expect(verifyRegistryTransition(registry, signed, makeVerifier(signer))).resolves.toBe(true);
    });

    it('rejects a root that no longer matches the state (drift)', async () => {
      const signed = await signRegistryTransition(registry, { type: 'register-pool', poolId: 'p1' }, signer);
      const drifted = registerLiquidityPool(registry, makePool('p2'));
      await expect(verifyRegistryTransition(drifted, signed, makeVerifier(signer))).resolves.toBe(false);
    });

    it('rejects a transition signed by a different signer', async () => {
      const signed = await signRegistryTransition(registry, { type: 'register-pool', poolId: 'p1' }, signer);
      const other = makeSigner('rooter-2');
      await expect(verifyRegistryTransition(registry, signed, makeVerifier(other))).resolves.toBe(false);
    });

    it('rejects a tampered op (opHash binding)', async () => {
      const signed = await signRegistryTransition(registry, { type: 'register-pool', poolId: 'p1' }, signer);
      signed.delta.op = { type: 'register-pool', poolId: 'p1-changed' };
      await expect(verifyRegistryTransition(registry, signed, makeVerifier(signer))).resolves.toBe(false);
    });

    it('rejects a bad signature via the verifier', async () => {
      const signed = await signRegistryTransition(registry, { type: 'register-pool', poolId: 'p1' }, signer);
      const forged = makeSigner(signer.publicKeyDigest, new Uint8Array([9, 9, 9]));
      await expect(verifyRegistryTransition(registry, signed, makeVerifier(forged))).resolves.toBe(false);
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
      for (const fn of ['serializeRegistryState', 'computeRegistryRoot', 'signRegistryTransition', 'verifyRegistryRoot', 'verifyRegistryTransition']) {
        expect(typeof (registryRootPort as never)[fn]).toBe('function');
      }
      expect(DEFAULT_REGISTRY_ROOT_DOMAIN).toMatch(/^totemsdk\/liquidity-bond\/registry\/v1$/);
    });
  });
});
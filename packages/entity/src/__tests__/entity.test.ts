/**
 * @totemsdk/entity — conformance tests (RFC-056 §7).
 */
import {
  createIdentityDocument,
  createIdentityClaim,
  createPaymentRecipientClaim,
  createServiceEndpointClaim,
  signIdentityClaim,
} from '@totemsdk/identity';
import type { IdentityGraph, IdentityProofVerifier } from '@totemsdk/identity';
import { signManifest } from '@totemsdk/manifest';
import type { Manifest, SignedManifest } from '@totemsdk/manifest';
import {
  createUnifiedChildTreeKey,
  scriptFromWotsPk,
  scriptToAddress,
  wotsKeypairFromSeed,
} from '@totemsdk/core';

import {
  EntityValidationError,
  computeEntityViewDigest,
  projectEntity,
  resolveEntity,
} from '../index';
import type { EntityAuthorityGrant } from '../index';

jest.setTimeout(120_000);

function testSeed(n: number): Uint8Array {
  const seed = new Uint8Array(32);
  seed[0] = n & 0xff;
  return seed;
}

function claimAddress(seed: Uint8Array, keyIndex = 0): string {
  const keypair = wotsKeypairFromSeed(seed, keyIndex);
  return scriptToAddress(scriptFromWotsPk(keypair.pk));
}

function manifestTree(seed: Uint8Array) {
  return createUnifiedChildTreeKey(seed, 0);
}

function manifestAddress(seed: Uint8Array): string {
  return scriptToAddress(scriptFromWotsPk(manifestTree(seed).getPublicKey()));
}

interface ClaimFixture {
  graph: IdentityGraph;
  root: string;
  seed: Uint8Array;
}

async function buildClaimFixture(): Promise<ClaimFixture> {
  const seed = testSeed(11);
  const root = claimAddress(seed, 0);
  const document = createIdentityDocument({
    kind: 'device',
    rootAddress: root,
    controllerAddress: root,
    metadata: { model: 'sensor-1', secret: 'do-not-disclose' },
  });

  const payment = createPaymentRecipientClaim({
    issuer: root,
    subject: document.id,
    address: 'MxPAYMENT',
    label: 'ops',
    issuedAt: 1000,
  });
  const endpoint = createServiceEndpointClaim({
    issuer: root,
    subject: document.id,
    endpointType: 'https',
    uri: 'https://sensor.example.test',
    issuedAt: 1000,
  });

  return {
    seed,
    root,
    graph: {
      document,
      claims: [
        await signIdentityClaim(payment, seed, 0),
        await signIdentityClaim(endpoint, seed, 0),
      ],
    },
  };
}

interface ManifestFixture {
  graph: IdentityGraph;
  signed: SignedManifest<Manifest>;
}

async function buildManifestFixture(): Promise<ManifestFixture> {
  const seed = testSeed(21);
  const root = manifestAddress(seed);
  const document = createIdentityDocument({
    kind: 'service',
    rootAddress: root,
    controllerAddress: root,
  });
  const manifest: Manifest = {
    type: 'edge-service',
    serviceId: 'svc-sensor-1',
    name: 'Sensor Service',
    version: '1.0.0',
    operatorAddress: root,
    serviceType: 'sensor',
    description: 'telemetry',
    capabilities: ['telemetry:read'],
    tags: ['sensor'],
  };
  const signed = await signManifest(manifest, manifestTree(seed), 0);
  return { graph: { document, claims: [] }, signed };
}

function validGrant(subject: string): EntityAuthorityGrant {
  return {
    id: 'grant-1',
    issuer: 'totem:issuer',
    subject,
    capabilities: ['telemetry:read'],
    validFrom: 1000,
    proofId: 'proof-1',
    verifiedBy: 'authority',
    verified: true,
  };
}

describe('RFC-056 entity projection', () => {
  let claims: ClaimFixture;
  let manifests: ManifestFixture;

  beforeAll(async () => {
    claims = await buildClaimFixture();
    manifests = await buildManifestFixture();
  });

  it('minimal projection discloses root only', async () => {
    const resolution = await resolveEntity({ identity: claims.graph }, { asOf: 2000 });
    const view = projectEntity(resolution);

    expect(view.mode).toBe('minimal');
    expect(view.disclosureLevel).toBe(0);
    expect(view.root.rootAddress).toBe(claims.root);
    expect(view.root.entityRef).toMatch(/^0x[0-9a-f]{64}$/);
    expect(view.disclosed).toEqual(['root']);
    expect(view.withheld).toEqual(['children', 'identity', 'manifest', 'claims', 'authority']);
    expect(view.status).toEqual({ root: 'known' });
    expect(view.identity).toBeUndefined();
    expect(view.manifest).toBeUndefined();
    expect(view.claims).toBeUndefined();
    expect(view.authority).toBeUndefined();
    expect(view.children).toBeUndefined();
  });

  it('available projection discloses verified sections and reports unknown ones', async () => {
    const resolution = await resolveEntity({ identity: claims.graph }, { asOf: 2000 });
    const view = projectEntity(resolution, { mode: 'available' });

    expect(view.disclosed).toEqual(['root', 'identity', 'claims']);
    expect(view.unknown).toEqual(['children', 'manifest', 'authority']);
    expect(view.invalid).toEqual([]);
    expect(view.identity?.id).toBe(claims.graph.document.id);
    expect(view.claims?.paymentRecipients).toHaveLength(1);
    expect(view.claims?.serviceEndpoints).toHaveLength(1);
    expect(view.manifest).toBeUndefined();
  });

  it('purpose-bound capabilities discloses root + manifest only', async () => {
    const resolution = await resolveEntity(
      { identity: manifests.graph, manifest: manifests.signed },
      { asOf: manifests.signed.signedAt },
    );
    const view = projectEntity(resolution, {
      mode: 'purpose-bound',
      purposes: ['capabilities'],
    });

    expect(view.disclosed).toEqual(['root', 'manifest']);
    expect(view.withheld).toEqual(['children', 'identity', 'claims', 'authority']);
    expect(view.identity).toBeUndefined();
    expect(view.claims).toBeUndefined();
    expect(view.manifest?.name).toBe('Sensor Service');
    expect(view.manifest?.capabilities).toEqual(['telemetry:read']);
  });

  it('purpose-bound authority discloses only verified grants', async () => {
    const resolution = await resolveEntity(
      {
        identity: claims.graph,
        authority: [validGrant(claims.graph.document.id)],
      },
      { asOf: 2000 },
    );
    const view = projectEntity(resolution, {
      mode: 'purpose-bound',
      purposes: ['authority'],
    });

    expect(view.disclosed).toEqual(['root', 'authority']);
    expect(view.withheld).toEqual(['children', 'identity', 'manifest', 'claims']);
    expect(view.authority).toHaveLength(1);
    expect(view.identity).toBeUndefined();
  });

  it('shared-root purpose discloses children only', async () => {
    const verifier: IdentityProofVerifier = {
      type: 'root-identity',
      async verify() {
        return {
          valid: true,
          rootAddress: claims.graph.document.rootAddress,
          provenAddresses: ['MxCHILD-1', 'MxCHILD-2'],
          metadata: { proofDigest: '0xproof' },
        };
      },
    };
    const resolution = await resolveEntity(
      { identity: claims.graph, rootIdentityProof: 'opaque-proof' },
      { asOf: 2000, proofVerifier: verifier },
    );
    const view = projectEntity(resolution, {
      mode: 'purpose-bound',
      purposes: ['shared-root'],
    });

    expect(view.disclosed).toEqual(['root', 'children']);
    expect(view.children?.provenAddresses).toEqual(['MxCHILD-1', 'MxCHILD-2']);
    expect(view.identity).toBeUndefined();
  });

  it('metadata is an explicit allow-list', async () => {
    const resolution = await resolveEntity({ identity: claims.graph }, { asOf: 2000 });

    const none = projectEntity(resolution, { mode: 'available' });
    expect(none.identity?.metadata).toBeUndefined();

    const selected = projectEntity(resolution, {
      mode: 'available',
      includeMetadata: ['model', 'missing'],
    });
    expect(selected.identity?.metadata).toEqual({ model: 'sensor-1' });
  });

  it('expired or unsigned claims are invalid, not unknown', async () => {
    const seed = testSeed(31);
    const root = claimAddress(seed, 0);
    const document = createIdentityDocument({
      kind: 'device',
      rootAddress: root,
      controllerAddress: root,
    });
    const expired = createIdentityClaim({
      type: 'payment_recipient',
      issuer: root,
      subject: document.id,
      object: 'MxPAYMENT',
      payload: {},
      issuedAt: 1000,
      expiresAt: 1500,
    });
    const graph: IdentityGraph = {
      document,
      claims: [await signIdentityClaim(expired, seed, 0)],
    };

    const resolution = await resolveEntity({ identity: graph }, { asOf: 2000 });
    expect(resolution.status.claims).toBe('invalid');
    expect(resolution.status.identity).toBe('known');

    const view = projectEntity(resolution, { mode: 'available' });
    expect(view.invalid).toContain('claims');
    expect(view.claims).toBeUndefined();
  });

  it('revoked identity is invalid and never falls back to supplied claims', async () => {
    const seed = testSeed(41);
    const root = claimAddress(seed, 0);
    const document = createIdentityDocument({
      kind: 'device',
      rootAddress: root,
      controllerAddress: root,
    });
    const revoke = createIdentityClaim({
      type: 'revokes',
      issuer: root,
      subject: document.id,
      object: document.id,
      payload: {},
      issuedAt: 1000,
    });
    const graph: IdentityGraph = {
      document,
      claims: [await signIdentityClaim(revoke, seed, 0)],
    };

    const resolution = await resolveEntity({ identity: graph }, { asOf: 2000 });
    expect(resolution.status.identity).toBe('invalid');
    expect(resolution.status.claims).toBe('invalid');

    const view = projectEntity(resolution, { mode: 'available' });
    expect(view.identity).toBeUndefined();
    expect(view.disclosed).not.toContain('identity');
    expect(view.invalid).toEqual(expect.arrayContaining(['identity', 'claims']));
  });

  it('invalid manifest binding is invalid and not returned raw', async () => {
    const resolution = await resolveEntity(
      { identity: claims.graph, manifest: manifests.signed },
      { asOf: manifests.signed.signedAt },
    );

    expect(resolution.status.manifest).toBe('invalid');
    expect(resolution.manifest?.binding.valid).toBe(false);

    const view = projectEntity(resolution, { mode: 'available' });
    expect(view.manifest).toBeUndefined();
    expect(view.invalid).toContain('manifest');
  });

  it('invalid authority grants are invalid; valid grants are known', async () => {
    const valid = validGrant(claims.graph.document.id);
    const bad: EntityAuthorityGrant = {
      ...validGrant(claims.graph.document.id),
      id: 'grant-bad',
      verified: false as never,
    };
    const resolution = await resolveEntity(
      { identity: claims.graph, authority: [valid, bad] },
      { asOf: 2000 },
    );

    expect(resolution.status.authority).toBe('known');
    expect(resolution.authority.map((grant) => grant.id)).toEqual(['grant-1']);
    expect(resolution.errors.join(' ')).toMatch(/not verified/);
  });

  it('view digest is deterministic and key-order independent', async () => {
    const resolution = await resolveEntity({ identity: claims.graph }, { asOf: 2000 });
    const first = projectEntity(resolution, { mode: 'available' });
    const second = projectEntity(resolution, { mode: 'available' });

    expect(first.digest).toBe(second.digest);
    expect(computeEntityViewDigest(first)).toBe(first.digest);

    const { digest: _digest, ...body } = first;
    const reversed = Object.fromEntries(Object.entries(body).reverse());
    expect(computeEntityViewDigest(reversed as typeof body)).toBe(first.digest);
  });

  it('purpose-bound requires purposes and rejects mismatched asOf', async () => {
    const resolution = await resolveEntity({ identity: claims.graph }, { asOf: 2000 });

    expect(() => projectEntity(resolution, { mode: 'purpose-bound' })).toThrow(
      EntityValidationError,
    );
    expect(() =>
      projectEntity(resolution, { mode: 'purpose-bound', purposes: [] }),
    ).toThrow(EntityValidationError);
    expect(() =>
      projectEntity(resolution, { mode: 'available', asOf: 2001 }),
    ).toThrow(EntityValidationError);
  });

  it('rejects malformed identity sources', async () => {
    await expect(
      resolveEntity({
        identity: {
          document: {
            id: '',
            kind: 'device',
            version: 1,
            rootAddress: '',
            controllerAddress: '',
            createdAt: 0,
          },
          claims: [],
        },
      }),
    ).rejects.toThrow(EntityValidationError);
  });
});

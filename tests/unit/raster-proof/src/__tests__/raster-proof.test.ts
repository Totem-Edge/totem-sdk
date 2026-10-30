/**
 * @totemsdk/raster-proof — test suite
 *
 * All tests use fixed timestamps and deterministic inputs. No test depends
 * on Date.now() unless time is explicitly injected.
 */

import {
  canonicalJson,
  computeRasterManifestId,
  hashRasterManifest,
  computeRasterWindowProofId,
  hashRasterWindowProof,
  hashBytes,
  hashString,
  chunkBytes,
  computeMerkleRoot,
  merkleLeafHash,
  createMerkleProof,
  verifyMerkleProof,
  createRasterMerkleSummary,
  createRasterManifest,
  validateRasterManifest,
  rasterManifestToEvidenceRef,
  createRasterWindowProof,
  rasterWindowProofToEvidenceRef,
  createDerivedRasterManifest,
  verifyRasterDerivation,
  rasterFootprintToSpatialObject,
  createRasterSpatialRelation,
  rasterEvidenceRefs,
  createUnsignedRasterProof,
  signRasterProof,
  verifyRasterProof,
  rasterManifestToProofGraphNode,
  rasterWindowProofToProofGraphNode,
  rasterManifestToGraphEdges,
  rasterWindowProofToGraphEdges,
} from '../index';
import type {
  RasterManifest,
  RasterWindowProof,
  RasterSpatialMetadata,
  RasterAssetRef,
} from '../index';
import type { SignedProof, UnsignedProof } from '@totemsdk/proof';
import { computeSpatialObjectId } from '@totemsdk/spatial-proof';

function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  s[1] = (n >> 8) & 0xff;
  return s;
}

const SEED = testSeed(21);
const T0 = 1_700_000_000_000;

function makeBytes(length: number, seed = 1): Uint8Array {
  const b = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    b[i] = (i * 31 + seed * 7) & 0xff;
  }
  return b;
}

const RASTER_BYTES = makeBytes(2500, 3);

const SPATIAL: RasterSpatialMetadata = {
  crs: 'EPSG:4326',
  bounds: [-1, -1, 2, 2],
  widthPx: 1024,
  heightPx: 768,
  resolutionM: 0.5,
};

function makeAsset(partial: Partial<RasterAssetRef> = {}): RasterAssetRef {
  const summary = createRasterMerkleSummary(RASTER_BYTES, { chunkSizeBytes: 1000 });
  return {
    uri: 'https://cdn.example/ortho.tif',
    mediaType: 'image/tiff',
    format: 'geotiff',
    byteSize: RASTER_BYTES.length,
    contentHash: summary.contentHash,
    hashAlgorithm: 'sha3-256',
    merkleRoot: summary.merkleRoot,
    chunkSizeBytes: 1000,
    ...partial,
  };
}

function makeManifest(partial: Partial<RasterManifest> = {}): RasterManifest {
  return createRasterManifest({
    sourceType: 'drone',
    layerType: 'rgb',
    capturedAt: T0,
    createdAt: T0,
    deviceId: 'drone-007',
    operatorId: 'op-1',
    missionId: 'mission-42',
    sceneId: 'scene-9',
    asset: makeAsset(),
    spatial: SPATIAL,
    ...partial,
  } as unknown as Parameters<typeof createRasterManifest>[0]);
}

// ── 1/2. hashBytes / hashString deterministic ─────────────────────────────

describe('hashBytes / hashString', () => {
  it('hashBytes is deterministic and 64-char lowercase hex', () => {
    const a = hashBytes(RASTER_BYTES);
    const b = hashBytes(RASTER_BYTES);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashBytes differs for different bytes', () => {
    expect(hashBytes(makeBytes(16, 1))).not.toBe(hashBytes(makeBytes(16, 2)));
  });

  it('hashString is deterministic and 64-char lowercase hex', () => {
    expect(hashString('totem-raster')).toBe(hashString('totem-raster'));
    expect(hashString('totem-raster')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

// ── 3/4. chunkBytes splits / rejects empty ────────────────────────────────

describe('chunkBytes', () => {
  it('splits bytes into fixed-size chunks with correct offsets and lengths', () => {
    const chunks = chunkBytes(RASTER_BYTES, 1000);
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toMatchObject({ index: 0, offset: 0, length: 1000 });
    expect(chunks[1]).toMatchObject({ index: 1, offset: 1000, length: 1000 });
    expect(chunks[2]).toMatchObject({ index: 2, offset: 2000, length: 500 });
    for (const c of chunks) {
      expect(c.hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('defaults to 64 KiB chunk size', () => {
    const chunks = chunkBytes(makeBytes(100_000));
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(64 * 1024);
    expect(chunks[1].length).toBe(100_000 - 64 * 1024);
  });

  it('rejects empty bytes', () => {
    expect(() => chunkBytes(new Uint8Array(0), 1000)).toThrow(/empty/);
  });

  it('rejects non-positive chunk sizes', () => {
    expect(() => chunkBytes(RASTER_BYTES, 0)).toThrow(/positive/);
    expect(() => chunkBytes(RASTER_BYTES, -5)).toThrow(/positive/);
  });

  it('produces content-derived chunk hashes (same bytes → same hash)', () => {
    const a = chunkBytes(RASTER_BYTES, 1000);
    const b = chunkBytes(RASTER_BYTES, 1000);
    expect(a.map((c) => c.hash)).toEqual(b.map((c) => c.hash));
  });
});

// ── 5. Merkle root deterministic ──────────────────────────────────────────

describe('computeMerkleRoot', () => {
  it('is deterministic for identical chunks', () => {
    const chunks = chunkBytes(RASTER_BYTES, 1000);
    expect(computeMerkleRoot(chunks)).toBe(computeMerkleRoot(chunkBytes(RASTER_BYTES, 1000)));
    expect(computeMerkleRoot(chunks)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when content changes', () => {
    const a = computeMerkleRoot(chunkBytes(makeBytes(2000, 1), 1000));
    const b = computeMerkleRoot(chunkBytes(makeBytes(2000, 2), 1000));
    expect(a).not.toBe(b);
  });

  it('handles odd chunk counts deterministically (promotion rule)', () => {
    const three = chunkBytes(makeBytes(2500, 5), 1000);
    expect(three.length).toBe(3);
    const root = computeMerkleRoot(three);
    const level0 = three.map((c) => merkleLeafHash(c));
    const level1 = [merkleNodeHash2(level0[0], level0[1]), level0[2]]; // promote last
    const expectedRoot = merkleNodeHash2(level1[0], level1[1]);
    expect(root).toBe(expectedRoot);
    expect(root).toMatch(/^[a-f0-9]{64}$/);
  });
});

// domain-separated hash mirroring merkle.ts internals, for the odd-layer expectation
function merkleNodeHash2(a: string, b: string): string {
  return hashBytes(new TextEncoder().encode('totem-raster-node' + a + b));
}

// ── 6/7. Merkle proof verifies / tampered fails ───────────────────────────

describe('Merkle proofs', () => {
  const chunks = chunkBytes(RASTER_BYTES, 1000);

  it('every leaf produces a valid proof', () => {
    for (let i = 0; i < chunks.length; i++) {
      const proof = createMerkleProof(chunks, i);
      expect(proof.leafIndex).toBe(i);
      expect(proof.leafHash).toBe(merkleLeafHash(chunks[i]));
      expect(verifyMerkleProof(proof)).toBe(true);
    }
  });

  it('tampered proof fails', () => {
    const proof = createMerkleProof(chunks, 1);
    const tampered = { ...proof, leafHash: hashBytes(makeBytes(4, 99)) };
    expect(verifyMerkleProof(tampered)).toBe(false);
  });

  it('tampered sibling fails', () => {
    const proof = createMerkleProof(chunks, 1);
    const tampered = {
      ...proof,
      siblings: [{ position: 'right' as const, hash: hashBytes(makeBytes(4, 88)) }],
    };
    expect(verifyMerkleProof(tampered)).toBe(false);
  });

  it('rejects out-of-range leafIndex', () => {
    expect(() => createMerkleProof(chunks, 99)).toThrow(/out of range/);
  });

  it('verifies a proof for an odd-count tree', () => {
    const odd = chunkBytes(makeBytes(2500, 5), 1000);
    expect(verifyMerkleProof(createMerkleProof(odd, 2))).toBe(true);
  });
});

// ── Merkle summary ────────────────────────────────────────────────────────

describe('createRasterMerkleSummary', () => {
  it('summarizes bytes, root, and chunking', () => {
    const summary = createRasterMerkleSummary(RASTER_BYTES, { chunkSizeBytes: 1000 });
    expect(summary.byteSize).toBe(2500);
    expect(summary.chunkCount).toBe(3);
    expect(summary.chunkSizeBytes).toBe(1000);
    expect(summary.contentHash).toBe(hashBytes(RASTER_BYTES));
    expect(summary.merkleRoot).toBe(computeMerkleRoot(chunkBytes(RASTER_BYTES, 1000)));
  });

  it('rejects empty bytes', () => {
    expect(() => createRasterMerkleSummary(new Uint8Array(0))).toThrow(/empty/);
  });
});

// ── 8. raster manifest ID deterministic ───────────────────────────────────

describe('computeRasterManifestId / createRasterManifest', () => {
  it('is deterministic for identical input', () => {
    const a = makeManifest();
    const b = makeManifest();
    expect(a.rasterId).toBe(b.rasterId);
    expect(a.rasterId).toMatch(/^totem:raster:[a-f0-9]{64}$/);
    expect(computeRasterManifestId({ ...a, rasterId: '' } as never)).toBe(a.rasterId);
  });

  it('differs when content differs', () => {
    expect(makeManifest({ layerType: 'thermal' }).rasterId).not.toBe(makeManifest().rasterId);
  });

  it('excludes only rasterId and metadata from the hash', () => {
    const a = makeManifest({ metadata: { foo: 'bar' } });
    const b = makeManifest({ metadata: { foo: 'baz' } });
    expect(a.rasterId).toBe(b.rasterId);
  });

  it('hashRasterManifest matches the recomputed stable hash', () => {
    const m = makeManifest();
    expect(hashRasterManifest(m)).toMatch(/^[a-f0-9]{64}$/);
    const recomputed = computeRasterManifestId({ ...m, rasterId: 'ignored', metadata: { x: 1 } } as never);
    expect('totem:raster:' + hashRasterManifest(m)).toBe(recomputed);
  });
});

// ── 9/10. manifest validation ─────────────────────────────────────────────

describe('validateRasterManifest', () => {
  it('accepts a well-formed manifest', () => {
    const result = validateRasterManifest(makeManifest());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects missing content hash', () => {
    const m = makeManifest();
    const bad: RasterManifest = {
      ...m,
      asset: { ...m.asset, contentHash: '' as never },
    };
    const result = validateRasterManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.join('; ')).toContain('contentHash');
  });

  it('rejects invalid hashAlgorithm', () => {
    const m = makeManifest();
    const result = validateRasterManifest({
      ...m,
      asset: { ...m.asset, hashAlgorithm: 'sha2' as never },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid bounds ordering and ranges', () => {
    const m = makeManifest();
    const bad = validateRasterManifest({ ...m, spatial: { ...m.spatial!, bounds: [2, -1, 1, 2] } });
    expect(bad.valid).toBe(false);
    expect(bad.errors.join('; ')).toContain('minLon must be <= maxLon');
    const outOfRange = validateRasterManifest({ ...m, spatial: { ...m.spatial!, bounds: [-200, 0, 1, 2] } });
    expect(outOfRange.valid).toBe(false);
  });

  it('rejects non-positive width/height/resolution', () => {
    const m = makeManifest();
    expect(validateRasterManifest({ ...m, spatial: { ...m.spatial!, widthPx: 0 } }).valid).toBe(false);
    expect(validateRasterManifest({ ...m, spatial: { ...m.spatial!, heightPx: -3 } }).valid).toBe(false);
    expect(validateRasterManifest({ ...m, spatial: { ...m.spatial!, resolutionM: 0 } }).valid).toBe(false);
  });

  it('rejects missing sourceType / layerType / format', () => {
    const m = makeManifest();
    expect(validateRasterManifest({ ...m, sourceType: undefined as never }).valid).toBe(false);
    expect(validateRasterManifest({ ...m, layerType: undefined as never }).valid).toBe(false);
    expect(validateRasterManifest({ ...m, asset: { ...m.asset, format: undefined as never } }).valid).toBe(false);
  });

  it('rejects negative byteSize and non-positive createdAt', () => {
    const m = makeManifest();
    expect(validateRasterManifest({ ...m, asset: { ...m.asset, byteSize: -1 } }).valid).toBe(false);
    expect(validateRasterManifest({ ...m, createdAt: -5 }).valid).toBe(false);
  });

  it('warns when capturedAt is far after createdAt unless explicitly allowed', () => {
    const m = makeManifest();
    const future = validateRasterManifest({ ...m, capturedAt: T0 + 30 * 24 * 3600 * 1000 });
    expect(future.valid).toBe(false);
    expect(future.errors.join('; ')).toContain('capturedAt is far after createdAt');
    const allowed = validateRasterManifest({
      ...m,
      capturedAt: T0 + 30 * 24 * 3600 * 1000,
      metadata: { allowFutureCapture: true },
    });
    expect(allowed.valid).toBe(true);
    expect(allowed.warnings.length).toBeGreaterThan(0);
  });

  it('warns for derived rasters without derivedFrom provenance', () => {
    const m = makeManifest({ sourceType: 'derived' });
    const result = validateRasterManifest(m);
    expect(result.valid).toBe(true);
    expect(result.warnings.join('; ')).toContain('derivedFrom');
  });
});

// ── 11. rasterManifestToEvidenceRef ───────────────────────────────────────

describe('rasterManifestToEvidenceRef', () => {
  it('contains the correct manifest hash', () => {
    const m = makeManifest();
    const ref = rasterManifestToEvidenceRef(m);
    expect(ref.id).toBe(m.rasterId);
    expect(ref.kind).toBe('raster-manifest');
    expect(ref.hash).toBe(hashRasterManifest(m));
  });
});

// ── 12/13/14. derived raster provenance ───────────────────────────────────

describe('derived raster provenance', () => {
  const source = makeManifest();
  const source2 = makeManifest({ layerType: 'multispectral' });

  it('derived manifest references sources', () => {
    const derived = createDerivedRasterManifest({
      sourceManifests: [source, source2],
      layerType: 'water-mask',
      asset: makeAsset(),
      pipelineId: 'flood-pipe',
      parametersHash: 'params-hash-1',
      createdAt: T0,
      capturedAt: T0,
      uncertainty: ['Mask is model output; manual verification recommended.'],
    });
    expect(derived.sourceType).toBe('derived');
    expect(derived.provenance?.derivedFrom).toEqual([source.rasterId, source2.rasterId]);
    expect(derived.provenance?.pipelineId).toBe('flood-pipe');
    expect(derived.provenance?.parametersHash).toBe('params-hash-1');
    expect(derived.provenance?.uncertainty).toEqual(['Mask is model output; manual verification recommended.']);
  });

  it('verifyRasterDerivation passes when all sources supplied', () => {
    const derived = createDerivedRasterManifest({
      sourceManifests: [source, source2],
      layerType: 'water-mask',
      asset: makeAsset(),
      createdAt: T0,
    });
    const result = verifyRasterDerivation(derived, [source, source2]);
    expect(result.valid).toBe(true);
    expect(result.sourceRasterIds).toEqual([source.rasterId, source2.rasterId]);
  });

  it('verifyRasterDerivation fails when a source is missing', () => {
    const derived = createDerivedRasterManifest({
      sourceManifests: [source, source2],
      layerType: 'water-mask',
      asset: makeAsset(),
      createdAt: T0,
    });
    const result = verifyRasterDerivation(derived, [source]);
    expect(result.valid).toBe(false);
    expect(result.missingSources).toContain(source2.rasterId);
  });

  it('verifyRasterDerivation fails for non-derived manifests', () => {
    const result = verifyRasterDerivation(makeManifest(), []);
    expect(result.valid).toBe(false);
  });

  it('verifyRasterDerivation fails when parametersHash is missing for a pipeline', () => {
    const derived = createDerivedRasterManifest({
      sourceManifests: [source],
      layerType: 'change-mask',
      asset: makeAsset(),
      pipelineId: 'diff-pipe',
      parametersHash: 'params-hash-1',
      createdAt: T0,
    }) as RasterManifest;
    derived.provenance = { ...derived.provenance!, parametersHash: undefined as never };
    const result = verifyRasterDerivation(derived, [source]);
    expect(result.valid).toBe(false);
    expect(result.reasons?.join('; ')).toContain('parametersHash');
  });

  it('preserves provenance uncertainty in the verify result', () => {
    const derived = createDerivedRasterManifest({
      sourceManifests: [source],
      layerType: 'water-mask',
      asset: makeAsset(),
      createdAt: T0,
      uncertainty: ['Reviewed by operator A.'],
    });
    const result = verifyRasterDerivation(derived, [source]);
    expect(result.uncertainty).toEqual(['Reviewed by operator A.']);
  });

  it('createDerivedRasterManifest throws without sources', () => {
    expect(() =>
      createDerivedRasterManifest({ sourceManifests: [], layerType: 'water-mask', asset: makeAsset() }),
    ).toThrow(/at least one source/);
  });

  it('createDerivedRasterManifest throws when pipelineId is set without parametersHash', () => {
    expect(() =>
      createDerivedRasterManifest({
        sourceManifests: [source],
        layerType: 'water-mask',
        asset: makeAsset(),
        pipelineId: 'p',
      }),
    ).toThrow(/parametersHash/);
  });
});

// ── 15. raster window proof ID deterministic ──────────────────────────────

describe('raster window proofs', () => {
  const chunks = chunkBytes(RASTER_BYTES, 1000);
  const root = computeMerkleRoot(chunks);

  function makeWindowProof(partial: Partial<RasterWindowProof> = {}): RasterWindowProof {
    return createRasterWindowProof({
      rasterId: 'totem:raster:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      merkleRoot: root,
      chunkIndices: [0, 2],
      chunkHashes: [chunks[0].hash, chunks[2].hash],
      spatial: SPATIAL,
      createdAt: T0,
      ...partial,
    } as unknown as Parameters<typeof createRasterWindowProof>[0]);
  }

  it('window proof ID is deterministic', () => {
    const a = makeWindowProof();
    const b = makeWindowProof();
    expect(a.windowProofId).toBe(b.windowProofId);
    expect(a.windowProofId).toMatch(/^totem:raster-window:[a-f0-9]{64}$/);
  });

  it('recomputes the same ID from stable fields', () => {
    const wp = makeWindowProof();
    const { windowProofId: _id, ...rest } = wp;
    expect(computeRasterWindowProofId(rest)).toBe(wp.windowProofId);
  });

  it('excludes windowProofId and metadata from the ID', () => {
    const a = makeWindowProof({ metadata: { k: 1 } });
    const b = makeWindowProof({ metadata: { k: 2 } });
    expect(a.windowProofId).toBe(b.windowProofId);
  });

  it('hashRasterWindowProof is stable', () => {
    expect(hashRasterWindowProof(makeWindowProof())).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects mismatched chunk arrays', () => {
    expect(() =>
      makeWindowProof({ chunkHashes: [chunks[0].hash] }),
    ).toThrow(/equal length/);
  });

  it('produces an evidence ref with the window proof hash', () => {
    const wp = makeWindowProof();
    const ref = rasterWindowProofToEvidenceRef(wp);
    expect(ref.id).toBe(wp.windowProofId);
    expect(ref.hash).toBe(hashRasterWindowProof(wp));
  });
});

// ── 16/17/18. proof envelope ──────────────────────────────────────────────

describe('createUnsignedRasterProof', () => {
  it('creates an attestation proof with the manifest in the payload', () => {
    const m = makeManifest();
    const proof = createUnsignedRasterProof({
      manifest: m,
      issuer: 'MxISSUER',
      issuedAt: T0,
    }) as UnsignedProof;
    expect(proof.kind).toBe('attestation');
    expect(proof.issuer).toBe('MxISSUER');
    expect(proof.subject.id).toBe(m.rasterId);
    const payload = proof.payload?.['rasterManifest'] as RasterManifest;
    expect(payload.rasterId).toBe(m.rasterId);
    expect(proof.evidence?.some((e) => e.kind === 'raster-manifest')).toBe(true);
    expect(proof.evidence?.some((e) => e.kind === 'raster-content')).toBe(true);
    expect(proof.evidence?.some((e) => e.kind === 'raster-merkle-root')).toBe(true);
  });

  it('includes source and window proof evidence for derived rasters', () => {
    const source = makeManifest();
    const derived = createDerivedRasterManifest({
      sourceManifests: [source],
      layerType: 'water-mask',
      asset: makeAsset(),
      createdAt: T0,
    });
    const chunks = chunkBytes(RASTER_BYTES, 1000);
    const windowProof = createRasterWindowProof({
      rasterId: derived.rasterId,
      merkleRoot: derived.asset.merkleRoot!,
      chunkIndices: [1],
      chunkHashes: [chunks[1].hash],
      createdAt: T0,
    });
    const proof = createUnsignedRasterProof({
      manifest: derived,
      windowProof,
      spatialObjectId: 'totem:spatial:site-1',
      issuedAt: T0,
    });
    expect(proof.evidence?.some((e) => e.kind === 'raster-source')).toBe(true);
    expect(proof.evidence?.some((e) => e.kind === 'raster-window-proof')).toBe(true);
    expect(proof.evidence?.some((e) => e.kind === 'spatial-object')).toBe(true);
    expect(proof.payload?.['windowProof']).toBeDefined();
  });
});

describe('signRasterProof / verifyRasterProof', () => {
  it('verifies a signed raster proof end to end', () => {
    const m = makeManifest();
    const unsigned = createUnsignedRasterProof({ manifest: m, issuedAt: T0 });
    const signed = signRasterProof(unsigned, SEED, 1) as SignedProof;
    expect(signed.signature).toBeDefined();
    const result = verifyRasterProof(signed);
    expect(result.valid).toBe(true);
    expect(result.rasterId).toBe(m.rasterId);
    expect(result.manifestHashValid).toBe(true);
  });

  it('verifies a signed proof with a window proof and Merkle proofs', () => {
    const m = makeManifest();
    const chunks = chunkBytes(RASTER_BYTES, 1000);
    const merkleProof = createMerkleProof(chunks, 1);
    const windowProof = createRasterWindowProof({
      rasterId: m.rasterId,
      merkleRoot: m.asset.merkleRoot!,
      chunkIndices: [1],
      chunkHashes: [chunks[1].hash],
      createdAt: T0,
    });
    const unsigned = createUnsignedRasterProof({
      manifest: m,
      windowProof,
      merkleProofs: [merkleProof],
      issuedAt: T0,
    });
    const signed = signRasterProof(unsigned, SEED, 2) as SignedProof;
    const result = verifyRasterProof(signed);
    expect(result.valid).toBe(true);
    expect(result.windowProofValid).toBe(true);
  });

  it('verifies a signed proof for a derived raster (structural derivation)', () => {
    const source = makeManifest();
    const derived = createDerivedRasterManifest({
      sourceManifests: [source],
      layerType: 'water-mask',
      asset: makeAsset(),
      createdAt: T0,
    });
    const unsigned = createUnsignedRasterProof({ manifest: derived, issuedAt: T0 });
    const signed = signRasterProof(unsigned, SEED, 3) as SignedProof;
    const result = verifyRasterProof(signed);
    expect(result.valid).toBe(true);
    expect(result.derivationValid).toBe(true);
  });

  it('rejects a tampered manifest', () => {
    const m = makeManifest();
    const unsigned = createUnsignedRasterProof({ manifest: m, issuedAt: T0 });
    const signed = signRasterProof(unsigned, SEED, 4) as SignedProof;
    const tampered: SignedProof = {
      ...signed,
      payload: { rasterManifest: { ...m, layerType: 'thermal' } },
    };
    const result = verifyRasterProof(tampered);
    expect(result.valid).toBe(false);
  });

  it('rejects a tampered content hash', () => {
    const m = makeManifest();
    const unsigned = createUnsignedRasterProof({ manifest: m, issuedAt: T0 });
    const signed = signRasterProof(unsigned, SEED, 5) as SignedProof;
    const tampered: SignedProof = {
      ...signed,
      payload: { rasterManifest: { ...m, asset: { ...m.asset, contentHash: hashBytes(makeBytes(8, 7)) } } },
    };
    const result = verifyRasterProof(tampered);
    expect(result.valid).toBe(false);
  });

  it('rejects a window proof whose root does not match the manifest', () => {
    const m = makeManifest();
    const chunks = chunkBytes(RASTER_BYTES, 1000);
    const wrongRoot = createRasterWindowProof({
      rasterId: m.rasterId,
      merkleRoot: computeMerkleRoot(chunkBytes(makeBytes(300, 9), 100)), // different asset root
      chunkIndices: [0],
      chunkHashes: [chunks[0].hash],
      createdAt: T0,
    });
    const unsigned = createUnsignedRasterProof({ manifest: m, windowProof: wrongRoot, issuedAt: T0 });
    const signed = signRasterProof(unsigned, SEED, 6) as SignedProof;
    const result = verifyRasterProof(signed);
    expect(result.valid).toBe(false);
    expect(result.windowProofValid).toBe(false);
  });

  it('rejects when merkle proof leaf is not referenced by the window proof', () => {
    const m = makeManifest();
    const chunks = chunkBytes(RASTER_BYTES, 1000);
    const windowProof = createRasterWindowProof({
      rasterId: m.rasterId,
      merkleRoot: m.asset.merkleRoot!,
      chunkIndices: [0],
      chunkHashes: [chunks[0].hash],
      createdAt: T0,
    });
    const offLeaf = createMerkleProof(chunks, 2);
    const unsigned = createUnsignedRasterProof({
      manifest: m,
      windowProof,
      merkleProofs: [offLeaf],
      issuedAt: T0,
    });
    const signed = signRasterProof(unsigned, SEED, 7) as SignedProof;
    const result = verifyRasterProof(signed);
    expect(result.valid).toBe(false);
  });

  it('rejects a derived raster with broken provenance structure', () => {
    const source = makeManifest();
    const broken = createRasterManifest({
      sourceType: 'derived',
      layerType: 'water-mask',
      asset: makeAsset(),
      createdAt: T0,
      provenance: { derivedFrom: [] },
    });
    const unsigned = createUnsignedRasterProof({ manifest: broken, issuedAt: T0 });
    const signed = signRasterProof(unsigned, SEED, 8) as SignedProof;
    const result = verifyRasterProof(signed);
    expect(result.valid).toBe(false);
    expect(result.derivationValid).toBe(false);
  });
});

// ── 19. spatial object helper ─────────────────────────────────────────────

describe('rasterFootprintToSpatialObject / createRasterSpatialRelation', () => {
  it('returns null when the manifest has no bounds', () => {
    const m = makeManifest();
    const bare: RasterManifest = { ...m, spatial: undefined };
    expect(rasterFootprintToSpatialObject(bare)).toBeNull();
  });

  it('returns a scene-footprint spatial object from bounds', () => {
    const m = makeManifest();
    const obj = rasterFootprintToSpatialObject(m);
    expect(obj).not.toBeNull();
    expect(obj!.kind).toBe('scene-footprint');
    expect(obj!.geometry.type).toBe('Polygon');
    expect(obj!.spatialId).toMatch(/^totem:spatial:[a-f0-9]{64}$/);
    expect(obj!.spatialId).toBe(computeSpatialObjectId({
      kind: 'scene-footprint',
      geometry: obj!.geometry,
      crs: 'EPSG:4326',
      name: `raster ${m.rasterId}`,
    }));
  });

  it('creates a spatial relation claim from the raster footprint', () => {
    const m = makeManifest();
    const site = rasterFootprintToSpatialObject(makeManifest())!;
    const claim = createRasterSpatialRelation({
      manifest: m,
      spatialObject: site,
      relation: 'covers',
      computedAt: T0,
    });
    expect(claim.subjectId).toBe(m.rasterId);
    expect(claim.subjectKind).toBe('raster-manifest');
    expect(claim.relation).toBe('covers');
    expect(claim.inputs.rasterManifestId).toBe(m.rasterId);
    expect(claim.result.matched).toBe(true);
  });

  it('throws when no bounds are available for a spatial relation', () => {
    const bare: RasterManifest = { ...makeManifest(), spatial: undefined };
    const site = rasterFootprintToSpatialObject(makeManifest())!;
    expect(() =>
      createRasterSpatialRelation({ manifest: bare, spatialObject: site, relation: 'covers' }),
    ).toThrow(/bounds/);
  });
});

// ── 20. proofgraph helpers ────────────────────────────────────────────────

describe('proofgraph helpers', () => {
  it('produces deterministic node and edge refs', () => {
    const m = makeManifest();
    const node = rasterManifestToProofGraphNode(m);
    expect(node.id).toBe('custom:' + m.rasterId);
    expect(node.type).toBe('custom');
    expect(node.data?.contentHash).toBe(m.asset.contentHash);

    const edges = rasterManifestToGraphEdges(m);
    expect(edges.some((e) => e.type === 'about' && e.to === 'drone-007')).toBe(true);
    expect(edges.some((e) => e.type === 'about' && e.to === 'op-1')).toBe(true);
    expect(edges.some((e) => e.type === 'about' && e.to === 'mission-42')).toBe(true);
  });

  it('emits derived_from edges for derived rasters', () => {
    const source = makeManifest();
    const derived = createDerivedRasterManifest({
      sourceManifests: [source],
      layerType: 'water-mask',
      asset: makeAsset(),
      createdAt: T0,
    });
    const edges = rasterManifestToGraphEdges(derived);
    expect(edges.some((e) => e.type === 'derived_from' && e.to === source.rasterId)).toBe(true);
  });

  it('produces deterministic edge ids for identical manifests', () => {
    const a = rasterManifestToGraphEdges(makeManifest());
    const b = rasterManifestToGraphEdges(makeManifest());
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });

  it('window proof node is deterministic and references the raster', () => {
    const chunks = chunkBytes(RASTER_BYTES, 1000);
    const wp = createRasterWindowProof({
      rasterId: 'totem:raster:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      merkleRoot: computeMerkleRoot(chunks),
      chunkIndices: [0],
      chunkHashes: [chunks[0].hash],
      createdAt: T0,
    });
    const node = rasterWindowProofToProofGraphNode(wp);
    expect(node.id).toBe('custom:' + wp.windowProofId);
    const edges = rasterWindowProofToGraphEdges(wp);
    expect(edges.some((e) => e.type === 'derived_from' && e.to === wp.rasterId)).toBe(true);
  });
});

// ── canonicalJson determinism ─────────────────────────────────────────────

describe('canonicalJson', () => {
  it('sorts keys deterministically', () => {
    const a = canonicalJson({ z: 1, a: { y: 2, b: 3 } });
    const b = canonicalJson({ a: { b: 3, y: 2 }, z: 1 });
    expect(a).toBe(b);
  });
});

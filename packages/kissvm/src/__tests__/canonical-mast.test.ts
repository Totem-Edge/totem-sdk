import {
  buildPolicyTree,
  compileMastTree,
  verifyScriptMembership,
  computeCanonicalScriptHash,
  buildLayeredMastScript,
  toNestedMastScript,
  type ProofChain,
} from '../index.js';

const pkA = 'aa'.repeat(32);
const pkB = 'bb'.repeat(32);

describe('RFC-016 P2: canonical MAST roots', () => {
  it('policy-tree roots/hashes are canonical MMR values verifiable by the compiler', () => {
    const rootScript = 'RETURN TRUE';
    const childScript = `ASSERT SIGNEDBY(0x${pkA}) RETURN TRUE`;

    const tree = buildPolicyTree([
      { id: 'root', name: 'Root', script: rootScript },
      { id: 'child', name: 'Child', script: childScript, parentId: 'root' },
    ]);

    const mast = compileMastTree([rootScript, childScript]);
    expect(tree.nodeMap.get('root')!.policyRoot).toBe(mast.rootHex);
    expect(tree.nodeMap.get('root')!.scriptHash).toBe(computeCanonicalScriptHash(rootScript));

    // The canonical proof for the root script verifies against the tree's root.
    expect(verifyScriptMembership(rootScript, mast.scripts[0].proofHex, mast.rootHex).valid).toBe(true);
  });

  it('buildLayeredMastScript uses canonical child roots and fails closed on empty layers', () => {
    const a = `ASSERT SIGNEDBY(0x${pkA}) RETURN TRUE`;
    const b = `ASSERT SIGNEDBY(0x${pkB}) RETURN TRUE`;

    const script = buildLayeredMastScript({
      assetId: 'asset',
      assetName: 'Asset',
      layers: [
        { id: 'a', name: 'A', script: a, authorityPkd: pkA },
        { id: 'b', name: 'B', script: b, authorityPkd: pkB },
      ],
    });

    expect(script).toContain(`MAST 0x${computeCanonicalScriptHash(b)}`);
    expect(() => buildLayeredMastScript({ assetId: 'x', assetName: 'X', layers: [] })).toThrow(/empty/i);
  });

  it('composes MAST as a terminal statement so the nested branch is reachable', () => {
    const a = `ASSERT STATE(0) EQ [a] RETURN TRUE`;
    const b = `ASSERT SIGNEDBY(0x${pkB}) RETURN TRUE`;
    const script = buildLayeredMastScript({
      assetId: 'x',
      assetName: 'X',
      layers: [
        { id: 'a', name: 'A', script: a, authorityPkd: pkA },
        { id: 'b', name: 'B', script: b, authorityPkd: pkB },
      ],
    });
    const lines = script.split('\n').map((l) => l.trim()).filter(Boolean);
    // parent's trailing RETURN is stripped and MAST is the final statement
    expect(lines).toContain('ASSERT STATE(0) EQ [a]');
    expect(lines.filter((l) => /^RETURN TRUE$/i.test(l))).toHaveLength(0);
    expect(lines[lines.length - 1]).toBe(`MAST 0x${computeCanonicalScriptHash(b)}`);
  });

  it('rejects an empty proof chain instead of compiling to allow-all', () => {
    const empty: ProofChain = { links: [], depth: 0, verified: false, leafScriptHash: '' };
    expect(() => toNestedMastScript(empty)).toThrow(/empty/i);
  });
});

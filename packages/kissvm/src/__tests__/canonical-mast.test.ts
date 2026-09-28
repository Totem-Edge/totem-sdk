import {
  buildPolicyTree,
  compileMastTree,
  verifyScriptMembership,
  computeCanonicalScriptHash,
  buildLayeredMastScript,
  buildLayeredPolicy,
  verifyProofChain,
  toMinimaProofExpression,
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

  it('buildLayeredPolicy proofChain verifies against the returned mastScript', () => {
    const a = `ASSERT STATE(0) EQ [a]\nRETURN TRUE`;
    const b = `ASSERT SIGNEDBY(0x${pkB})\nRETURN TRUE`;
    const { proofChain, mastScript } = buildLayeredPolicy({
      assetId: 'x',
      assetName: 'X',
      layers: [
        { id: 'a', name: 'A', script: a, authorityPkd: pkA },
        { id: 'b', name: 'B', script: b, authorityPkd: pkB },
      ],
    });
    expect(proofChain.links[0].script).toBe(mastScript);
    expect(proofChain.links[0].script).toContain(`MAST 0x${proofChain.links[1].policyRoot}`);
    expect(verifyProofChain(proofChain).valid).toBe(true);
  });

  it('PROOF formats the script argument as a bracketed SCRIPT literal', () => {
    const script = 'RETURN TRUE';
    const mast = compileMastTree([script]);
    const link = {
      scriptHash: computeCanonicalScriptHash(script),
      policyRoot: mast.rootHex,
      proof: mast.scripts[0].proofHex,
      script,
    };
    // Defaults to the link's script, wrapped in [ ] per Minima's SCRIPT literal.
    expect(toMinimaProofExpression(link)).toMatch(/^PROOF\(\[RETURN TRUE\] 0 0x[0-9a-f]+ 0 0x[0-9a-f]*\)$/);
    expect(toMinimaProofExpression(link, script)).toContain('PROOF([RETURN TRUE]');
    // An explicit hex preimage is passed through, never bracketed.
    expect(toMinimaProofExpression(link, 'deadbeef', { dataType: 'hex' })).toContain('PROOF(0xdeadbeef');
  });

  it('PROOF refuses to double-hash and rejects a mismatched preimage', () => {
    const script = 'RETURN TRUE';
    const link = {
      scriptHash: computeCanonicalScriptHash(script),
      policyRoot: compileMastTree([script]).rootHex,
      proof: '',
      script,
    };
    expect(() => toMinimaProofExpression(link, link.scriptHash)).toThrow(/double-hash/);
    expect(() => toMinimaProofExpression(link, `0x${link.scriptHash}`)).toThrow(/double-hash/);
    expect(() => toMinimaProofExpression(link, 'RETURN FALSE')).toThrow(/does not hash to the link leaf/);
  });

  it('rejects an empty proof chain instead of compiling to allow-all', () => {
    const empty: ProofChain = { links: [], depth: 0, verified: false, leafScriptHash: '' };
    expect(() => toNestedMastScript(empty)).toThrow(/empty/i);
  });

  it('refuses to compose a layer whose terminal RETURN is not TRUE (RFC-018 RM-COMPOSE-001)', () => {
    const a = `ASSERT STATE(0) EQ [a]\nRETURN FALSE`;
    const b = `ASSERT SIGNEDBY(0x${pkB})\nRETURN TRUE`;
    expect(() =>
      buildLayeredMastScript({
        assetId: 'x',
        assetName: 'X',
        layers: [
          { id: 'a', name: 'A', script: a, authorityPkd: pkA },
          { id: 'b', name: 'B', script: b, authorityPkd: pkB },
        ],
      }),
    ).toThrow(/RETURN TRUE/);
  });

  it('refuses to compose a proof chain whose parent ends in RETURN FALSE (RFC-018)', () => {
    const parentScript = `ASSERT STATE(0) EQ [a]\nRETURN FALSE`;
    const childScript = `ASSERT SIGNEDBY(0x${pkB})\nRETURN TRUE`;
    const childMast = compileMastTree([childScript]);
    const chain: ProofChain = {
      links: [
        { scriptHash: computeCanonicalScriptHash(parentScript), policyRoot: computeCanonicalScriptHash(parentScript), proof: '', script: parentScript },
        { scriptHash: computeCanonicalScriptHash(childScript), policyRoot: childMast.rootHex, proof: '', script: childScript },
      ],
      depth: 2,
      verified: false,
      leafScriptHash: '',
    };
    expect(() => toNestedMastScript(chain)).toThrow(/RETURN TRUE/);
  });
});

/**
 * RFC-018 RM-COMPOSE-001: composing a terminal MAST must fail closed.
 *
 * MAST is terminal, so appending it after a layer's `RETURN` makes the child
 * branch dead. Only a terminal `RETURN TRUE` may be stripped; any other
 * terminal RETURN (an explicit deny) must abort composition.
 */
import {
  toNestedMastScript,
  computeCanonicalScriptHash,
  compileMastTree,
  type ProofChain,
} from '../index.js';

const pkB = 'bb'.repeat(32);

function chainWithParent(parentScript: string): ProofChain {
  const childScript = `ASSERT SIGNEDBY(0x${pkB})\nRETURN TRUE`;
  const childMast = compileMastTree([childScript]);
  return {
    links: [
      {
        scriptHash: computeCanonicalScriptHash(parentScript),
        policyRoot: computeCanonicalScriptHash(parentScript),
        proof: '',
        script: parentScript,
      },
      {
        scriptHash: computeCanonicalScriptHash(childScript),
        policyRoot: childMast.rootHex,
        proof: '',
        script: childScript,
      },
    ],
    depth: 2,
    verified: false,
    leafScriptHash: '',
  };
}

describe('RFC-018 RM-COMPOSE-001: composition fails closed', () => {
  it('rejects an empty proof chain instead of compiling to allow-all', () => {
    const empty: ProofChain = { links: [], depth: 0, verified: false, leafScriptHash: '' };
    expect(() => toNestedMastScript(empty)).toThrow(/empty/i);
  });

  it('refuses a parent layer whose terminal RETURN is not TRUE', () => {
    expect(() => toNestedMastScript(chainWithParent('ASSERT STATE(0) EQ [a]\nRETURN FALSE'))).toThrow(
      /RETURN TRUE/,
    );
  });

  it('strips an inline RETURN TRUE so the child MAST is reachable', () => {
    const chain = chainWithParent('ASSERT STATE(0) EQ [a] RETURN TRUE');
    const script = toNestedMastScript(chain);
    const lines = script.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines).toContain('ASSERT STATE(0) EQ [a]');
    expect(lines.filter((l) => /RETURN TRUE/i.test(l))).toHaveLength(0);
    expect(lines[lines.length - 1]).toBe(`MAST 0x${chain.links[1].policyRoot}`);
  });
});

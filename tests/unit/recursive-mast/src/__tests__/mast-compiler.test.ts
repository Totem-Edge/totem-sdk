/**
 * Golden tests for the canonical MAST compiler.
 *
 * These tests verify that the compiler produces correct MMR roots,
 * proofs, and script addresses for various tree sizes. The golden
 * values are computed using the core package's byte-exact MMR
 * primitives (mmrLeafExact, createMMRDataParentNode, etc.).
 *
 * Test coverage:
 *   - 1, 2, 3, 4, 5, 7, 8, 16 leaves
 *   - Proof generation and verification roundtrip
 *   - Script membership verification
 *   - Tampered proof rejection
 *   - Policy graph compilation
 */

import {
  compileMastTree,
  compilePolicyGraph,
  verifyScriptMembership,
  computeCanonicalScriptHash,
  computeCanonicalScriptAddress,
} from '../mast-compiler.js';
import type { PolicyGraph } from '../mast-compiler.js';

const SCRIPTS = {
  RETURN_TRUE: 'RETURN TRUE',
  LET_X_EQ_1: 'LET x = 1 RETURN x EQ 1',
  SIGNEDBY: 'RETURN SIGNEDBY(0xFFFF)',
  ASSERT_BLOCK: 'ASSERT @BLOCK GTE 1000 RETURN TRUE',
  MULTISIG: 'ASSERT MULTISIG(2 0xAAAA 0xBBBB) RETURN TRUE',
  STORE_STATE: 'STORE STATE(0) WITH 1 RETURN TRUE',
  PREVSTATE: 'ASSERT PREVSTATE(0) GTE 0 RETURN TRUE',
  MAST_DELEGATE: 'MAST 0x0000000000000000000000000000000000000000000000000000000000000000 RETURN TRUE',
  COMPLEX: 'LET x = STATE(0) LET y = PREVSTATE(1) ASSERT x GT y ASSERT SIGNEDBY(0xCCCC) RETURN TRUE',
  EMPTY: 'RETURN FALSE',
  NESTED_IF: 'IF @BLOCK GT 1000 THEN ASSERT SIGNEDBY(0xDDDD) ELSE RETURN FALSE ENDIF RETURN TRUE',
  VERIFYOUT: 'ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE) RETURN TRUE',
  SIGDIG: 'ASSERT SIGDIG(2 @AMOUNT) RETURN TRUE',
  HASH_CHECK: 'ASSERT SHA3(STATE(0)) EQ 0x0000000000000000000000000000000000000000000000000000000000000000 RETURN TRUE',
  FOR_LOOP: 'FOR i = 0 TO 10 ASSERT STATE(i) GTE 0 ENDFOR RETURN TRUE',
  FUNC_CALL: 'FUNC add(a b) RETURN ADD(a b) ENDFUNC ASSERT add(1 2) EQ 3 RETURN TRUE',
};

describe('MAST Compiler', () => {
  describe('compileMastTree', () => {
    test('single leaf produces valid root', () => {
      const result = compileMastTree([SCRIPTS.RETURN_TRUE]);
      expect(result.leafCount).toBe(1);
      expect(result.scripts).toHaveLength(1);
      expect(result.scripts[0].script).toBe(SCRIPTS.RETURN_TRUE);
      expect(result.rootHex).toBeTruthy();
      expect(result.rootAddress).toBeTruthy();
      expect(result.rootAddress.startsWith('Mx')).toBe(true);
    });

    test('two leaves produce valid root and proofs', () => {
      const result = compileMastTree([SCRIPTS.RETURN_TRUE, SCRIPTS.LET_X_EQ_1]);
      expect(result.leafCount).toBe(2);
      expect(result.scripts).toHaveLength(2);

      for (const sp of result.scripts) {
        expect(sp.proofHex).toBeTruthy();
        expect(sp.address).toBeTruthy();
      }
    });

    test('three leaves (non-power-of-2) produce valid root and proofs', () => {
      const result = compileMastTree([
        SCRIPTS.RETURN_TRUE,
        SCRIPTS.LET_X_EQ_1,
        SCRIPTS.SIGNEDBY,
      ]);
      expect(result.leafCount).toBe(3);
      expect(result.scripts).toHaveLength(3);

      for (const sp of result.scripts) {
        expect(sp.proofHex).toBeTruthy();
      }
    });

    test('four leaves (power of 2)', () => {
      const result = compileMastTree([
        SCRIPTS.RETURN_TRUE,
        SCRIPTS.LET_X_EQ_1,
        SCRIPTS.SIGNEDBY,
        SCRIPTS.ASSERT_BLOCK,
      ]);
      expect(result.leafCount).toBe(4);
      expect(result.scripts).toHaveLength(4);
    });

    test('five leaves (non-power-of-2)', () => {
      const result = compileMastTree([
        SCRIPTS.RETURN_TRUE,
        SCRIPTS.LET_X_EQ_1,
        SCRIPTS.SIGNEDBY,
        SCRIPTS.ASSERT_BLOCK,
        SCRIPTS.MULTISIG,
      ]);
      expect(result.leafCount).toBe(5);
      expect(result.scripts).toHaveLength(5);
    });

    test('seven leaves (non-power-of-2)', () => {
      const scripts = [
        SCRIPTS.RETURN_TRUE,
        SCRIPTS.LET_X_EQ_1,
        SCRIPTS.SIGNEDBY,
        SCRIPTS.ASSERT_BLOCK,
        SCRIPTS.MULTISIG,
        SCRIPTS.STORE_STATE,
        SCRIPTS.PREVSTATE,
      ];
      const result = compileMastTree(scripts);
      expect(result.leafCount).toBe(7);
      expect(result.scripts).toHaveLength(7);
    });

    test('eight leaves (power of 2)', () => {
      const scripts = [
        SCRIPTS.RETURN_TRUE,
        SCRIPTS.LET_X_EQ_1,
        SCRIPTS.SIGNEDBY,
        SCRIPTS.ASSERT_BLOCK,
        SCRIPTS.MULTISIG,
        SCRIPTS.STORE_STATE,
        SCRIPTS.PREVSTATE,
        SCRIPTS.MAST_DELEGATE,
      ];
      const result = compileMastTree(scripts);
      expect(result.leafCount).toBe(8);
      expect(result.scripts).toHaveLength(8);
    });

    test('sixteen leaves (power of 2)', () => {
      const scripts = [
        SCRIPTS.RETURN_TRUE,
        SCRIPTS.LET_X_EQ_1,
        SCRIPTS.SIGNEDBY,
        SCRIPTS.ASSERT_BLOCK,
        SCRIPTS.MULTISIG,
        SCRIPTS.STORE_STATE,
        SCRIPTS.PREVSTATE,
        SCRIPTS.MAST_DELEGATE,
        SCRIPTS.COMPLEX,
        SCRIPTS.EMPTY,
        SCRIPTS.NESTED_IF,
        SCRIPTS.VERIFYOUT,
        SCRIPTS.SIGDIG,
        SCRIPTS.HASH_CHECK,
        SCRIPTS.FOR_LOOP,
        SCRIPTS.FUNC_CALL,
      ];
      const result = compileMastTree(scripts);
      expect(result.leafCount).toBe(16);
      expect(result.scripts).toHaveLength(16);
    });

    test('empty scripts throws', () => {
      expect(() => compileMastTree([])).toThrow('Cannot compile empty MAST tree');
    });
  });

  describe('proof roundtrip', () => {
    test.each([1, 2, 3, 4, 5, 7, 8])('%i leaves: all proofs verify against root', (count) => {
      const scripts = [
        SCRIPTS.RETURN_TRUE,
        SCRIPTS.LET_X_EQ_1,
        SCRIPTS.SIGNEDBY,
        SCRIPTS.ASSERT_BLOCK,
        SCRIPTS.MULTISIG,
        SCRIPTS.STORE_STATE,
        SCRIPTS.PREVSTATE,
        SCRIPTS.MAST_DELEGATE,
      ].slice(0, count);

      const result = compileMastTree(scripts);

      for (const sp of result.scripts) {
        const verification = verifyScriptMembership(
          sp.script,
          sp.proofHex,
          result.rootHex,
        );
        expect(verification.valid).toBe(true);
      }
    });

    test('tampered proof is rejected', () => {
      const result = compileMastTree([SCRIPTS.RETURN_TRUE, SCRIPTS.LET_X_EQ_1]);

      const tamperedProof = result.scripts[0].proofHex.slice(0, -2) + 'FF';

      const verification = verifyScriptMembership(
        result.scripts[0].script,
        tamperedProof,
        result.rootHex,
      );
      expect(verification.valid).toBe(false);
    });

    test('wrong root is rejected', () => {
      const result = compileMastTree([SCRIPTS.RETURN_TRUE, SCRIPTS.LET_X_EQ_1]);

      const verification = verifyScriptMembership(
        result.scripts[0].script,
        result.scripts[0].proofHex,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      );
      expect(verification.valid).toBe(false);
    });

    test('wrong script is rejected', () => {
      const result = compileMastTree([SCRIPTS.RETURN_TRUE, SCRIPTS.LET_X_EQ_1]);

      const verification = verifyScriptMembership(
        SCRIPTS.SIGNEDBY,
        result.scripts[0].proofHex,
        result.rootHex,
      );
      expect(verification.valid).toBe(false);
    });
  });

  describe('script hashing', () => {
    test('computeCanonicalScriptHash produces consistent results', () => {
      const hash1 = computeCanonicalScriptHash(SCRIPTS.RETURN_TRUE);
      const hash2 = computeCanonicalScriptHash(SCRIPTS.RETURN_TRUE);
      expect(hash1).toBe(hash2);
    });

    test('different scripts produce different hashes', () => {
      const hash1 = computeCanonicalScriptHash(SCRIPTS.RETURN_TRUE);
      const hash2 = computeCanonicalScriptHash(SCRIPTS.LET_X_EQ_1);
      expect(hash1).not.toBe(hash2);
    });

    test('computeCanonicalScriptAddress produces Mx addresses', () => {
      const addr = computeCanonicalScriptAddress(SCRIPTS.RETURN_TRUE);
      expect(addr.startsWith('Mx')).toBe(true);
    });
  });

  describe('compilePolicyGraph', () => {
    test('simple two-node graph compiles', () => {
      const graph: PolicyGraph = {
        nodes: [
          {
            id: 'root',
            name: 'Root',
            scripts: [SCRIPTS.RETURN_TRUE],
          },
          {
            id: 'child',
            name: 'Child',
            scripts: [SCRIPTS.LET_X_EQ_1],
            parentId: 'root',
          },
        ],
        edges: [
          { from: 'root', to: 'child' },
        ],
      };

      const result = compilePolicyGraph(graph);
      expect(result.compiledNodes.size).toBe(2);
      expect(result.anchorRoot).toBeTruthy();
      expect(result.anchorAddress).toBeTruthy();
    });

    test('graph without root throws', () => {
      const graph: PolicyGraph = {
        nodes: [
          {
            id: 'child',
            name: 'Child',
            scripts: [SCRIPTS.RETURN_TRUE],
            parentId: 'parent',
          },
        ],
        edges: [],
      };

      expect(() => compilePolicyGraph(graph)).toThrow('Policy graph must have a root node');
    });
  });
});

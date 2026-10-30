/**
 * RFC-031 P1 — KISSVM SHA2 / SHA3 opcode oracle vectors.
 *
 * The evaluator's `SHA2` (SHA-256) and `SHA3` (SHA3-256) opcodes are
 * consensus-critical: a script's on-chain result depends on them matching the
 * C++/Java node. These pin them to standard NIST vectors so a future refactor
 * (e.g. swapping the hash implementation) cannot silently diverge.
 *
 * NIST vectors for "abc":
 *   SHA-256   = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
 *   SHA3-256  = 3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532
 */

import { evaluateScript } from '../index';
import type { TxContext } from '../index';

function run(script: string) {
  const ctx: TxContext = {
    block: 1000,
    inputIndex: 0,
    inputs: [],
    outputs: [],
    state: {},
    prevState: {},
    simulationMode: true,
  };
  return evaluateScript(script, { signatures: new Map() }, ctx);
}

const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const SHA3_256_ABC = '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532';

describe('KISSVM hash opcodes — oracle vectors (RFC-031)', () => {
  it('SHA2 matches NIST SHA-256("abc")', () => {
    expect(run(`ASSERT SHA2(0x616263) EQ 0x${SHA256_ABC}\nRETURN TRUE`).success).toBe(true);
  });

  it('SHA2 rejects a wrong digest', () => {
    expect(run(`ASSERT SHA2(0x616263) EQ 0x${SHA3_256_ABC}\nRETURN TRUE`).success).toBe(false);
  });

  it('SHA3 matches NIST SHA3-256("abc")', () => {
    expect(run(`ASSERT SHA3(0x616263) EQ 0x${SHA3_256_ABC}\nRETURN TRUE`).success).toBe(true);
  });

  it('SHA3 rejects a wrong digest', () => {
    expect(run(`ASSERT SHA3(0x616263) EQ 0x${SHA256_ABC}\nRETURN TRUE`).success).toBe(false);
  });
});

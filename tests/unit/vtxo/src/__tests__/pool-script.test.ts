/**
 * OMN-059 — the unilateral exit branch must preserve the authorized commitment
 * root and epoch.
 */

import { buildPoolScript } from '../pool-script.js';

const OWNER_A = '0x' + '11'.repeat(32);
const OWNER_B = '0x' + '22'.repeat(32);
const OPERATOR = '0x' + '33'.repeat(32);

describe('OMN-059 VTXO pool exit branch', () => {
  const script = buildPoolScript({
    operatorPublicKeyDigest: OPERATOR,
    holders: [OWNER_A, OWNER_B],
    exitBlock: 100,
  });

  it('preserves the commitment root and epoch in every holder exit', () => {
    // One assertion pair per holder branch.
    expect(script.match(/ASSERT STATE\(100\) EQ PREVSTATE\(100\)/g)).toHaveLength(2);
    expect(script.match(/ASSERT STATE\(101\) EQ PREVSTATE\(101\)/g)).toHaveLength(2);
  });

  it('keeps the existing per-share and exit-block guards', () => {
    expect(script).toMatch(/ASSERT SAMESTATE\(102 102\)/);
    expect(script).toMatch(/ASSERT VERIFYOUT\(0 /);
    expect(script).toMatch(/ASSERT STATE\(128\) EQ 0/);
    expect(script).toMatch(/ASSERT STATE\(129\) EQ 0/);
  });
});

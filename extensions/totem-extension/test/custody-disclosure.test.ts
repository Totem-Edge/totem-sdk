/**
 * RFC-058 — custody disclosure hard gate.
 */

import {
  acknowledgeCustodyDisclosure,
  assertCustodyDisclosureAcknowledged,
  custodyDisclosureId,
  custodyDisclosureWarnings,
  isCustodyDisclosureAcknowledged,
  requiresCustodyDisclosure,
  validateCustodyDisclosure,
  CUSTODY_ACK_STORAGE_KEY,
  type CustodyDisclosure,
} from '../src/core/custody/disclosure';

const store: Record<string, unknown> = {};
(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (key: string) => ({ [key]: store[key] }),
      set: async (value: Record<string, unknown>) => { Object.assign(store, value); },
    },
  },
};

function hosted(overrides: Partial<CustodyDisclosure> = {}): CustodyDisclosure {
  return {
    mode: 'hosted',
    operatorId: 'op-1',
    legalEntity: 'Example Custody Ltd',
    jurisdiction: 'GB',
    keyManagement: 'hsm',
    canMoveFunds: true,
    canFreeze: true,
    operatorDiscretion: false,
    withdrawalTerms: 'T+1, limits apply',
    disclosureHash: '0x' + 'aa'.repeat(32),
    disclosureVersion: '2026-10-20',
    policySummary: '2-person approval over 10k',
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

describe('custody disclosure gate', () => {
  it('gates hosted and trust-minimised custody but not self custody', () => {
    expect(requiresCustodyDisclosure({ mode: 'self' })).toBe(false);
    expect(requiresCustodyDisclosure(hosted())).toBe(true);
    expect(requiresCustodyDisclosure({ mode: 'trust-minimised', reason: 'x', mitigation: 'y' })).toBe(true);
  });

  it('validates the required hosted disclosure fields', () => {
    expect(() => validateCustodyDisclosure(hosted())).not.toThrow();
    expect(() => validateCustodyDisclosure(hosted({ disclosureHash: '' }))).toThrow(/disclosureHash/);
    expect(() => validateCustodyDisclosure(hosted({ keyManagement: 'wallet' }))).toThrow(/wallet/);
    expect(() => validateCustodyDisclosure(hosted({ canFreeze: undefined }))).toThrow(/canFreeze/);
    expect(() => validateCustodyDisclosure({ mode: 'trust-minimised' })).toThrow(/reason/);
  });

  it('binds the acknowledgement to the disclosure id', async () => {
    const custody = hosted();
    const id = custodyDisclosureId(custody);
    await expect(assertCustodyDisclosureAcknowledged(custody)).rejects.toThrow(/CUSTODY_DISCLOSURE_REQUIRED/);
    const ack = await acknowledgeCustodyDisclosure(custody, 1234);
    expect(ack.disclosureId).toBe(id);
    expect(await isCustodyDisclosureAcknowledged(custody)).toBe(true);
    expect(store[CUSTODY_ACK_STORAGE_KEY]).toBeTruthy();
    await expect(assertCustodyDisclosureAcknowledged(custody)).resolves.toBeUndefined();

    const changed = hosted({ disclosureHash: '0x' + 'bb'.repeat(32) });
    expect(await isCustodyDisclosureAcknowledged(changed)).toBe(false);
  });

  it('shows movement, freeze and no-yield warnings', () => {
    const warnings = custodyDisclosureWarnings(hosted()).join(' ');
    expect(warnings).toMatch(/operator can move funds/);
    expect(warnings).toMatch(/freeze/);
    expect(warnings).toMatch(/No yield/);
    expect(warnings).toMatch(/T\+1/);
  });
});

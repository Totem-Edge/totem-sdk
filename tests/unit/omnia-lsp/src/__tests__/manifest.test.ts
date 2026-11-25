import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  quoteMatchesManifest,
  rankProviders,
  validateManifest,
  validateOpenQuote,
  type OmniaLspCandidate,
  type OmniaLspManifest,
  type OmniaLspOpenQuote,
} from '../index';

const VECTORS = join(__dirname, '../../../../../packages/omnia-lsp/test-vectors');

function vector<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(VECTORS, name), 'utf8')) as T;
}

const validManifest = vector<OmniaLspManifest>('manifest.valid.json');
const validQuote = vector<OmniaLspOpenQuote>('open-quote.valid.json');

describe('Omnia LSP manifest validation', () => {
  test('accepts the canonical valid manifest', () => {
    const result = validateManifest(validManifest);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('rejects a malformed channel public key digest', () => {
    const result = validateManifest(vector('manifest.invalid-channel-key.json'));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/publicKeyDigest/);
  });

  test('rejects minChannel above maxChannel', () => {
    const result = validateManifest(vector('manifest.invalid-capacity.json'));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/minChannel/);
  });

  test('requires a disclosure hash for hosted custody that can move funds', () => {
    const result = validateManifest(vector('manifest.invalid-hosted.json'));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/disclosureHash/);
  });

  test('rejects a stale manifest', () => {
    const stale = { ...validManifest, expiresAt: 1 };
    const result = validateManifest(stale, { now: 2 });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/expiresAt/);
  });

  test('rejects hosted custody when policy forbids it', () => {
    const hosted = {
      ...validManifest,
      custody: {
        mode: 'hosted' as const,
        canMoveFunds: false,
      },
    };
    const result = validateManifest(hosted, { rejectHostedCustody: true });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/hosted custody/);
  });
});

describe('Omnia LSP open quote validation', () => {
  test('accepts the canonical valid quote', () => {
    const result = validateOpenQuote(validQuote);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('rejects a quote for a different provider', () => {
    const result = validateOpenQuote(validQuote, { expectedProviderId: 'someone-else' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/providerId/);
  });

  test('binds a quote to the manifest channel identity', () => {
    expect(quoteMatchesManifest(validQuote, validManifest)).toEqual({ ok: true, errors: [] });

    const wrong = { ...validQuote, providerPublicKeyDigest: `0x${'99'.repeat(32)}` };
    const result = quoteMatchesManifest(wrong, validManifest);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/providerPublicKeyDigest/);
  });
});

describe('Omnia LSP ranking', () => {
  function candidate(providerId: string, score: number, overrides: Partial<OmniaLspCandidate> = {}): OmniaLspCandidate {
    return {
      manifest: {
        ...validManifest,
        providerId,
        fees: { openBps: 0, routingBps: 10 },
      },
      score,
      inboundCapacity: '1000',
      outboundCapacity: '1000',
      bonded: true,
      ...overrides,
    };
  }

  test('sorts by score, then fee, then capacity', () => {
    const low = candidate('prov-low', 60);
    const high = candidate('prov-high', 90);
    const expensive = candidate('prov-expensive', 90, {
      manifest: { ...validManifest, providerId: 'prov-expensive', fees: { openBps: 50 } },
    });

    const ranked = rankProviders([low, expensive, high], {
      tokenId: '0x00',
      amount: '100',
      direction: 'both',
    });

    expect(ranked.map((entry) => entry.candidate.manifest.providerId)).toEqual([
      'prov-high',
      'prov-expensive',
      'prov-low',
    ]);
  });

  test('filters insufficient capacity and policy violations', () => {
    const thin = candidate('prov-thin', 90, { inboundCapacity: '5', outboundCapacity: '5' });
    const hosted = candidate('prov-hosted', 90, {
      manifest: {
        ...validManifest,
        providerId: 'prov-hosted',
        custody: { mode: 'hosted', canMoveFunds: false },
      },
    });
    const good = candidate('prov-good', 80);

    const ranked = rankProviders([thin, hosted, good], {
      tokenId: '0x00',
      amount: '100',
      direction: 'both',
    }, { minScore: 70 });

    expect(ranked.map((entry) => entry.candidate.manifest.providerId)).toEqual(['prov-good']);
  });

  test('requires a bond when policy asks for one', () => {
    const unbonded = candidate('prov-unbonded', 90, { bonded: false });
    const bonded = candidate('prov-bonded', 80);

    const ranked = rankProviders([unbonded, bonded], {
      tokenId: '0x00',
      amount: '100',
      direction: 'both',
    }, { requireBond: true });

    expect(ranked.map((entry) => entry.candidate.manifest.providerId)).toEqual(['prov-bonded']);
  });
});

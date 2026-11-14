import { describe, expect, it } from 'vitest';
import { toPortfolioEntry } from '../../../../../packages/realtime/src/normalize.js';

const ADDRESS = 'MxG080DP9FYHSVE9E3NF9NY58FP1ZYGQRN2RNTG34R7ASV1PM8M405D0JSGG04P';
const ART = '<artimage>/9j/4AAQSkZJRgABAQAAAQABAAD</artimage>';

describe('toPortfolioEntry token metadata', () => {
  it('unwraps the JSON metadata document stored in a node token name', () => {
    const entry = toPortfolioEntry(
      {
        tokenid: '0xD1FE988A42D9901A37E5087F637B6E81FA44AD0D5C510BB8BC0F9694834682A6',
        confirmed: '1',
        unconfirmed: '0',
        token: {
          name: JSON.stringify({
            name: 'eurobuddha',
            ticker: 'EUROB',
            url: ART,
            description: 'Minima Spirit Animal',
            webvalidate: 'https://eurobuddha.com/tokens/proofs/eurobuddha.txt',
          }),
          decimals: 0,
        },
      },
      ADDRESS,
    );

    expect(entry.name).toBe('eurobuddha');
    expect(entry.ticker).toBe('EUROB');
    expect(entry.description).toBe('Minima Spirit Animal');
    expect(entry.webvalidate).toBe('https://eurobuddha.com/tokens/proofs/eurobuddha.txt');
    expect(entry.artimage).toBe(ART);
    expect(entry.url).toBe(ART);
  });

  it('preserves top-level portfolio fields from the Axia response', () => {
    const entry = toPortfolioEntry(
      {
        kind: 'nft',
        tokenid: '0x639F9679B9B37A7BF721190AC70C757CCDB4E902883892F804B8F438BF4F4BF5',
        confirmed: '1',
        unconfirmed: '0',
        total: '1',
        decimals: 0,
        name: 'Minima Space Whale',
        ticker: '',
        url: ART,
      } as any,
      ADDRESS,
    );

    expect(entry.name).toBe('Minima Space Whale');
    expect(entry.url).toBe(ART);
    expect(entry.artimage).toBe(ART);
  });

  it('does not leave a raw JSON blob in the name when parsing fails safely', () => {
    const entry = toPortfolioEntry(
      {
        tokenid: '0x050DFE5A588A20C7CFA1336AB07A2F1784A943A0A43A0B40A708469C42DF62C1',
        confirmed: '999',
        token: { name: 'not-json', ticker: 'porq' },
      },
      ADDRESS,
    );

    expect(entry.name).toBe('not-json');
    expect(entry.ticker).toBe('porq');
  });

  it('keeps a fungible token with artwork and decimals=0 classified as a token', () => {
    const entry = toPortfolioEntry(
      {
        tokenid: '0x050DFE5A588A20C7CFA1336AB07A2F1784A943A0A43A0B40A708469C42DF62C1',
        confirmed: '999',
        decimals: 0,
        token: {
          name: JSON.stringify({ name: 'porq', ticker: 'porq', url: ART }),
          decimals: 0,
        },
      },
      ADDRESS,
    );

    expect(entry.kind).toBe('token');
    expect(entry.artimage).toBe(ART);
  });
});

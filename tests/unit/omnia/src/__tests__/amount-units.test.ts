import { atomsToAmount, amountToAtoms } from '@totemsdk/core';
import { buildFundingTx, omniaDraftToCanonicalMinimaBytes } from '../transactions';

/**
 * The funding coin's serialized amount must be a Java `MiniNumber` whose
 * decimal value is the intended MINIMA amount. Java reads
 * `MiniNumber(unscaled, scale)` as `unscaled x 10^-scale`, so atoms
 * (2e43 for 0.2 MINIMA) must be written with scale 44 — scale 0 would encode
 * 2e43 MINIMA and fail `isValidMinimaValue()` (0 < amount <= 1,000,000,000).
 */
describe('@totemsdk/omnia — on-chain amount encoding', () => {
  const SCRIPT = 'RETURN TRUE';
  const ADDRESS = '0x' + 'aa'.repeat(32);
  const COIN_ID = '0x' + 'bb'.repeat(32);
  const OWNER = '0x' + 'cc'.repeat(32);

  function canonicalBytes(totalAtoms: bigint): Uint8Array {
    const draft = buildFundingTx(
      SCRIPT,
      ADDRESS,
      totalAtoms,
      '0x00',
      0,
      [COIN_ID],
      [totalAtoms],
      [OWNER],
    );
    return omniaDraftToCanonicalMinimaBytes(draft);
  }

  /** Decode the first input coin's MiniNumber amount from the canonical bytes. */
  function firstInputAmount(bytes: Uint8Array): { scale: number; unscaled: bigint } {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    const readMiniNumber = () => {
      const scale = buffer[offset++];
      const length = buffer[offset++];
      const hex = buffer.slice(offset, offset + length).toString('hex');
      const unscaled = length ? BigInt('0x' + hex) : 0n;
      offset += length;
      return { scale, unscaled };
    };
    const skipMiniData = () => {
      const length = buffer.readUInt32BE(offset);
      offset += 4 + length;
    };

    const inputCount = readMiniNumber();
    expect(inputCount.unscaled).toBe(1n);

    skipMiniData(); // input coin id
    skipMiniData(); // input address
    return readMiniNumber();
  }

  it('writes a fractional channel amount as MiniNumber(atoms, scale 44)', () => {
    const total = amountToAtoms('0.2');
    const amount = firstInputAmount(canonicalBytes(total));

    expect(amount.scale).toBe(44);
    expect(amount.unscaled).toBe(total);
    // Java reads this back as 0.2 MINIMA, a legal coin value.
    expect(atomsToAmount(amount.unscaled)).toBe('0.2');
    expect(Number(atomsToAmount(amount.unscaled))).toBeLessThanOrEqual(1_000_000_000);
  });

  it('round-trips a whole amount through the wire form', () => {
    const total = amountToAtoms('3');
    const amount = firstInputAmount(canonicalBytes(total));

    expect(amount.scale).toBe(44);
    expect(atomsToAmount(amount.unscaled)).toBe('3');
  });
});

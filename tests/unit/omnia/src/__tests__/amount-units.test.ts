import { atomsToAmount, amountToAtoms } from '@totemsdk/core';
import { buildFundingTx, buildUpdateTx, omniaDraftToCanonicalMinimaBytes } from '../transactions';
import { programAmountState, programNumberState } from '../state-vars';
import type { OmniaChannel } from '../types';

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

  function readCoin(buffer: Buffer, start: number) {
    let o = start;
    const mn = () => {
      const scale = buffer[o++];
      const len = buffer[o++];
      const hex = buffer.slice(o, o + len).toString('hex');
      const unscaled = len ? BigInt('0x' + hex) : 0n;
      o += len;
      return { scale, unscaled };
    };
    const md = () => {
      const len = buffer.readUInt32BE(o);
      o += 4 + len;
    };
    md(); // coin id
    md(); // address
    const amount = mn();
    md(); // token id
    const storeState = buffer[o++];
    mn(); md(); // mmr entry
    o += 1; // spent
    mn(); // created
    const count = mn();
    const state: Array<{ port: number; scale: number; unscaled: bigint }> = [];
    for (let i = 0; i < Number(count.unscaled); i++) {
      const port = buffer[o++];
      const type = buffer[o++];
      if (type === 2) {
        state.push({ port, ...mn() });
      } else if (type === 1 || type === 4) {
        md();
      } else if (type === 8) {
        o += 1;
      } else {
        throw new Error(`unexpected state type ${type}`);
      }
    }
    o += 1; // trailing token-presence byte
    return { amount, storeState, state, end: o };
  }

  it('writes value-bearing state ports with scale 44 and counters with scale 0', () => {
    const channel: OmniaChannel = {
      channelId: '0xamountunits',
      fundingTxId: '0xtxpow',
      fundingCoinId: '0x' + 'bb'.repeat(32),
      fundingScript: SCRIPT,
      programId: 'htlc-payment',
      programVersion: 1,
      fundingAddress: ADDRESS,
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: amountToAtoms('1'),
      parties: [
        { partyId: 'alice', publicKeyDigest: '0x' + '11'.repeat(32), addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: '0x' + '22'.repeat(32), addressIndex: 1 },
      ],
      balances: { alice: amountToAtoms('0.6'), bob: amountToAtoms('0.4') },
      pendingHTLCs: [],
      currentSequence: 0,
      latestState: null,
      stateLog: [],
      status: 'active',
      createdAt: 0,
      updatedAt: 0,
    };

    const draft = buildUpdateTx(
      channel,
      1,
      channel.balances,
      [],
      [
        programAmountState(141, amountToAtoms('0.2')),
        programNumberState(120, 5n),
      ],
    );
    const buffer = Buffer.from(omniaDraftToCanonicalMinimaBytes(draft));
    let offset = 0;
    const readCount = () => {
      const scale = buffer[offset++];
      const len = buffer[offset++];
      const unscaled = BigInt('0x' + buffer.slice(offset, offset + len).toString('hex'));
      offset += len;
      return { scale, unscaled };
    };
    expect(readCount().unscaled).toBe(1n); // one input
    const input = readCoin(buffer, offset);
    offset = input.end;
    expect(readCount().unscaled).toBe(1n); // one output
    const output = readCoin(buffer, offset);

    expect(output.amount).toEqual({ scale: 44, unscaled: amountToAtoms('1') });
    const locked = output.state.find((sv) => sv.port === 141);
    expect(locked).toEqual({ port: 141, scale: 44, unscaled: amountToAtoms('0.2') });
    const counter = output.state.find((sv) => sv.port === 120);
    expect(counter).toEqual({ port: 120, scale: 0, unscaled: 5n });
  });

  it('round-trips a whole amount through the wire form', () => {
    const total = amountToAtoms('3');
    const amount = firstInputAmount(canonicalBytes(total));

    expect(amount.scale).toBe(44);
    expect(atomsToAmount(amount.unscaled)).toBe('3');
  });
});

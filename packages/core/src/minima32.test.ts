import { describe, it, expect } from 'vitest';
import { encodeMxRadix32Frame, decodeMxRadix32Frame } from './minima32';

describe('Minima radix-32 with swaps', () => {
  it('roundtrips arbitrary frames', () => {
    const frame = Uint8Array.from([0x01, 0x00, 0x02, 0xaa, 0xff, 0xde, 0xad, 0xbe, 0xef].slice(0, 6));
    const mx = encodeMxRadix32Frame(frame);
    const back = decodeMxRadix32Frame(mx);
    expect([...back]).toEqual([...frame]);
  });
});
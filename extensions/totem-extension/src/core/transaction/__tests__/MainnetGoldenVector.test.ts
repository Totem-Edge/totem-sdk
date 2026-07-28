/**
 * Mainnet Golden Vector Tests
 * 
 * These tests validate our serialization against real mainnet data from
 * the Minima network. The test data comes from a coinexport command
 * on a live Minima node.
 * 
 * Source: attached_assets/Pasted--command-coinexport-params-coinid-0x902DAA22DBB4BB78B47_1768939432426.txt
 * 
 * This provides byte-exact validation that our TypeScript serialization
 * matches Minima's Java implementation.
 */

import {
  writeMiniData,
  writeMiniNumber,
  writeMiniByte,
  writeHashToStream,
  writeMMREntryNumber,
  hexToBytes,
  bytesToHex,
  concat
} from '../utils/Streamable';

describe('Mainnet Golden Vector - CoinProof', () => {
  /**
   * Complete CoinProof hex data from mainnet coinexport command.
   * 
   * Coin data:
   *   - coinid: 0x902DAA22DBB4BB78B47F3A74714CCFD603B4ED1B91DC899EE37A4B82ED359F19
   *   - address: 0x9225ABD37AA6BA3C395BA33A94EAD090D028036CB587BD2A19D11DC4FB2FE425
   *   - amount: 0.999 (raw: 9990, scale: 4)
   *   - tokenid: 0x00
   *   - storestate: false
   *   - mmrentry: 1310603 (0x13FF8B)
   *   - spent: false
   *   - created: 1905489 (0x1D1351)
   *   - state: [] (empty)
   *   - hasToken: false
   * 
   * MMRProof data:
   *   - blocktime: 1905536 (0x1D1380)
   *   - prooflength: 4
   *   - Proof entries with isLeft, data (32-byte hash), and value
   */
  const MAINNET_COINPROOF_HEX = '0x00000020902DAA22DBB4BB78B47F3A74714CCFD603B4ED1B91DC899EE37A4B82ED359F19000000209225ABD37AA6BA3C395BA33A94EAD090D028036CB587BD2A19D11DC4FB2FE425040227060000000100000001000000000313FF8B0000031D13510001000000031D13800001040100000020CB9AC8594B4A74DFDA05A80B9B8252312548222A8EA11844682290AED32471D9000100010000002022C350324F8F458A2DA933720BD5A605EABD2C44A167972D963DBA77FCD994E004042E8D6AA700000000203650F9FFE9752137EF3A48CA77531852AC2428492741C7B77440930A1D6CBA760A04060236040100000020E5C70918EE735E83ADFAC5033B3C8CF924D2888DF601B0AE2B417452CCFE30CA0706063CFD8275E9';

  const coinproofBytes = hexToBytes(MAINNET_COINPROOF_HEX);

  describe('MiniData serialization', () => {
    it('should serialize coinid (32-byte hash) correctly', () => {
      const coinid = hexToBytes('0x902DAA22DBB4BB78B47F3A74714CCFD603B4ED1B91DC899EE37A4B82ED359F19');
      const result = writeHashToStream(coinid);
      
      const expected = coinproofBytes.slice(0, 36);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should serialize address (32-byte hash) correctly', () => {
      const address = hexToBytes('0x9225ABD37AA6BA3C395BA33A94EAD090D028036CB587BD2A19D11DC4FB2FE425');
      const result = writeHashToStream(address);
      
      const expected = coinproofBytes.slice(36, 72);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should serialize tokenid (0x00, 1 byte) correctly', () => {
      const tokenid = hexToBytes('0x00');
      const result = writeHashToStream(tokenid);
      
      const expected = coinproofBytes.slice(76, 81);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });
  });

  describe('MiniNumber serialization', () => {
    it('should serialize amount 0.999 (raw=9990, scale=4) correctly', () => {
      const result = writeMiniNumber(9990n, 4);
      
      const expected = coinproofBytes.slice(72, 76);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should serialize blockcreated 1905489 (scale=0) correctly', () => {
      const result = writeMiniNumber(1905489n, 0);
      
      const expected = coinproofBytes.slice(93, 98);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should serialize blocktime 1905536 (scale=0) correctly', () => {
      const result = writeMiniNumber(1905536n, 0);
      
      const expected = coinproofBytes.slice(102, 107);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should serialize prooflength 4 (scale=0) correctly', () => {
      const result = writeMiniNumber(4n, 0);
      
      const expected = coinproofBytes.slice(107, 110);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should serialize state.size 0 (scale=0) correctly', () => {
      const result = writeMiniNumber(0n, 0);
      
      const expected = coinproofBytes.slice(98, 101);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });
  });

  describe('MiniByte serialization', () => {
    it('should serialize storestate=false correctly', () => {
      const result = writeMiniByte(false);
      expect(result).toEqual(new Uint8Array([0x00]));
      expect(result[0]).toBe(coinproofBytes[81]);
    });

    it('should serialize spent=false correctly', () => {
      const result = writeMiniByte(false);
      expect(result).toEqual(new Uint8Array([0x00]));
      expect(result[0]).toBe(coinproofBytes[92]);
    });

    it('should serialize hasToken=false correctly', () => {
      const result = writeMiniByte(false);
      expect(result).toEqual(new Uint8Array([0x00]));
      expect(result[0]).toBe(coinproofBytes[101]);
    });

    it('should serialize isLeft=true correctly', () => {
      const result = writeMiniByte(true);
      expect(result).toEqual(new Uint8Array([0x01]));
      expect(result[0]).toBe(coinproofBytes[110]);
    });

    it('should serialize isLeft=false correctly', () => {
      const result = writeMiniByte(false);
      expect(result).toEqual(new Uint8Array([0x00]));
      expect(result[0]).toBe(coinproofBytes[193]);
    });
  });

  describe('MMREntryNumber serialization', () => {
    it('should serialize mmrentry 1310603 correctly', () => {
      const result = writeMMREntryNumber(1310603n);
      
      const expected = coinproofBytes.slice(82, 92);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should match expected byte pattern for mmrentry', () => {
      const result = writeMMREntryNumber(1310603n);
      expect(bytesToHex(result)).toBe('0x0001000000000313ff8b');
    });
  });

  describe('MMRProof entry serialization', () => {
    it('should serialize first proof entry data hash correctly', () => {
      const hash = hexToBytes('0xCB9AC8594B4A74DFDA05A80B9B8252312548222A8EA11844682290AED32471D9');
      const result = writeMiniData(hash);
      
      const expected = coinproofBytes.slice(111, 147);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should serialize first proof entry value 0 correctly', () => {
      const result = writeMiniNumber(0n, 0);
      
      const expected = coinproofBytes.slice(147, 150);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should serialize second proof entry value 78101.9815 correctly', () => {
      const result = writeMiniNumber(781019815n, 4);
      
      const expected = coinproofBytes.slice(187, 193);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should serialize third proof entry value 0.0100808196 correctly', () => {
      const result = writeMiniNumber(100808196n, 10);
      
      const expected = coinproofBytes.slice(230, 236);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should serialize fourth proof entry value 685902.0989929 correctly', () => {
      const result = writeMiniNumber(6859020989929n, 7);
      
      const expected = coinproofBytes.slice(273, 281);
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });
  });

  describe('Complete Coin serialization', () => {
    it('should serialize complete Coin structure matching bytes 0-102', () => {
      const coinBytes = serializeCoin({
        coinid: hexToBytes('0x902DAA22DBB4BB78B47F3A74714CCFD603B4ED1B91DC899EE37A4B82ED359F19'),
        address: hexToBytes('0x9225ABD37AA6BA3C395BA33A94EAD090D028036CB587BD2A19D11DC4FB2FE425'),
        amount: 9990n,
        amountScale: 4,
        tokenid: hexToBytes('0x00'),
        storestate: false,
        mmrentry: 1310603n,
        spent: false,
        blockcreated: 1905489n,
        states: [],
        hasToken: false
      });

      const expected = coinproofBytes.slice(0, 102);
      expect(bytesToHex(coinBytes)).toBe(bytesToHex(expected));
    });
  });

  describe('Complete MMRProof serialization', () => {
    it('should serialize complete MMRProof structure matching bytes 102-281', () => {
      const proofBytes = serializeMMRProof({
        blocktime: 1905536n,
        entries: [
          { isLeft: true, data: hexToBytes('0xCB9AC8594B4A74DFDA05A80B9B8252312548222A8EA11844682290AED32471D9'), value: 0n, valueScale: 0 },
          { isLeft: true, data: hexToBytes('0x22C350324F8F458A2DA933720BD5A605EABD2C44A167972D963DBA77FCD994E0'), value: 781019815n, valueScale: 4 },
          { isLeft: false, data: hexToBytes('0x3650F9FFE9752137EF3A48CA77531852AC2428492741C7B77440930A1D6CBA76'), value: 100808196n, valueScale: 10 },
          { isLeft: true, data: hexToBytes('0xE5C70918EE735E83ADFAC5033B3C8CF924D2888DF601B0AE2B417452CCFE30CA'), value: 6859020989929n, valueScale: 7 }
        ]
      });

      const expected = coinproofBytes.slice(102, 281);
      expect(bytesToHex(proofBytes)).toBe(bytesToHex(expected));
    });
  });

  describe('Complete CoinProof serialization', () => {
    it('should serialize complete CoinProof matching all 281 bytes', () => {
      const coinProofBytes = serializeCoinProof({
        coin: {
          coinid: hexToBytes('0x902DAA22DBB4BB78B47F3A74714CCFD603B4ED1B91DC899EE37A4B82ED359F19'),
          address: hexToBytes('0x9225ABD37AA6BA3C395BA33A94EAD090D028036CB587BD2A19D11DC4FB2FE425'),
          amount: 9990n,
          amountScale: 4,
          tokenid: hexToBytes('0x00'),
          storestate: false,
          mmrentry: 1310603n,
          spent: false,
          blockcreated: 1905489n,
          states: [],
          hasToken: false
        },
        proof: {
          blocktime: 1905536n,
          entries: [
            { isLeft: true, data: hexToBytes('0xCB9AC8594B4A74DFDA05A80B9B8252312548222A8EA11844682290AED32471D9'), value: 0n, valueScale: 0 },
            { isLeft: true, data: hexToBytes('0x22C350324F8F458A2DA933720BD5A605EABD2C44A167972D963DBA77FCD994E0'), value: 781019815n, valueScale: 4 },
            { isLeft: false, data: hexToBytes('0x3650F9FFE9752137EF3A48CA77531852AC2428492741C7B77440930A1D6CBA76'), value: 100808196n, valueScale: 10 },
            { isLeft: true, data: hexToBytes('0xE5C70918EE735E83ADFAC5033B3C8CF924D2888DF601B0AE2B417452CCFE30CA'), value: 6859020989929n, valueScale: 7 }
          ]
        }
      });

      expect(coinProofBytes.length).toBe(281);
      expect(bytesToHex(coinProofBytes)).toBe(MAINNET_COINPROOF_HEX.toLowerCase());
    });
  });
});

interface CoinData {
  coinid: Uint8Array;
  address: Uint8Array;
  amount: bigint;
  amountScale: number;
  tokenid: Uint8Array;
  storestate: boolean;
  mmrentry: bigint;
  spent: boolean;
  blockcreated: bigint;
  states: any[];
  hasToken: boolean;
}

interface MMRProofEntry {
  isLeft: boolean;
  data: Uint8Array;
  value: bigint;
  valueScale: number;
}

interface MMRProofData {
  blocktime: bigint;
  entries: MMRProofEntry[];
}

interface CoinProofData {
  coin: CoinData;
  proof: MMRProofData;
}

function serializeCoin(coin: CoinData): Uint8Array {
  return concat(
    writeHashToStream(coin.coinid),
    writeHashToStream(coin.address),
    writeMiniNumber(coin.amount, coin.amountScale),
    writeHashToStream(coin.tokenid),
    writeMiniByte(coin.storestate),
    writeMMREntryNumber(coin.mmrentry),
    writeMiniByte(coin.spent),
    writeMiniNumber(coin.blockcreated, 0),
    writeMiniNumber(BigInt(coin.states.length), 0),
    writeMiniByte(coin.hasToken)
  );
}

function serializeMMRProof(proof: MMRProofData): Uint8Array {
  const parts: Uint8Array[] = [
    writeMiniNumber(proof.blocktime, 0),
    writeMiniNumber(BigInt(proof.entries.length), 0)
  ];

  for (const entry of proof.entries) {
    parts.push(
      writeMiniByte(entry.isLeft),
      writeMiniData(entry.data),
      writeMiniNumber(entry.value, entry.valueScale)
    );
  }

  return concat(...parts);
}

function serializeCoinProof(coinProof: CoinProofData): Uint8Array {
  return concat(
    serializeCoin(coinProof.coin),
    serializeMMRProof(coinProof.proof)
  );
}

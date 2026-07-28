/**
 * Byte-Parity Tests for Java-Compatible Serialization
 * 
 * These tests verify that TypeScript serialization produces byte-exact
 * output matching Minima's Java implementation.
 * 
 * Reference: Java classes in attached_assets/
 *   - StateVariable.java
 *   - MiniData.java
 *   - MiniNumber.java
 *   - MiniString.java
 *   - MiniByte.java
 */

import {
  writeMiniData,
  writeMiniNumber,
  writeMiniString,
  writeMiniByte,
  writeHashToStream,
  writeMMREntryNumber,
  writeStateVariable,
  bigIntToByteArray,
  hexToBytes,
  bytesToHex,
  STATETYPE_HEX,
  STATETYPE_NUMBER,
  STATETYPE_STRING,
  STATETYPE_BOOL,
  StateVariableValue
} from '../utils/Streamable';

describe('Streamable Primitives', () => {
  describe('writeMiniByte', () => {
    it('should encode boolean true as 0x01', () => {
      const result = writeMiniByte(true);
      expect(bytesToHex(result)).toBe('0x01');
    });

    it('should encode boolean false as 0x00', () => {
      const result = writeMiniByte(false);
      expect(bytesToHex(result)).toBe('0x00');
    });

    it('should encode number 0 as 0x00', () => {
      const result = writeMiniByte(0);
      expect(bytesToHex(result)).toBe('0x00');
    });

    it('should encode number 255 as 0xff', () => {
      const result = writeMiniByte(255);
      expect(bytesToHex(result)).toBe('0xff');
    });

    it('should throw for values > 255', () => {
      expect(() => writeMiniByte(256)).toThrow();
    });

    it('should throw for negative values', () => {
      expect(() => writeMiniByte(-1)).toThrow();
    });
  });

  describe('writeMiniData', () => {
    it('should encode empty data as 4-byte zero length', () => {
      const result = writeMiniData(new Uint8Array(0));
      expect(bytesToHex(result)).toBe('0x00000000');
    });

    it('should encode single byte with 4-byte length prefix', () => {
      const result = writeMiniData(new Uint8Array([0xab]));
      expect(bytesToHex(result)).toBe('0x00000001ab');
    });

    it('should encode multiple bytes correctly', () => {
      const data = new Uint8Array([0x01, 0x02, 0x03]);
      const result = writeMiniData(data);
      expect(bytesToHex(result)).toBe('0x00000003010203');
    });

    it('should handle 32-byte hash data', () => {
      const hash = new Uint8Array(32).fill(0xff);
      const result = writeMiniData(hash);
      expect(result.length).toBe(4 + 32);
      expect(bytesToHex(result).substring(0, 10)).toBe('0x00000020'); // 0x20 = 32
    });
  });

  describe('writeMiniNumber', () => {
    it('should encode zero as scale=0, len=1, data=0x00', () => {
      const result = writeMiniNumber(0n);
      expect(bytesToHex(result)).toBe('0x000100');
    });

    it('should encode 1 with scale=0', () => {
      const result = writeMiniNumber(1n);
      expect(bytesToHex(result)).toBe('0x000101');
    });

    it('should encode 127 without leading zero (high bit not set)', () => {
      const result = writeMiniNumber(127n);
      expect(bytesToHex(result)).toBe('0x00017f');
    });

    it('should encode 128 with leading zero (high bit set)', () => {
      const result = writeMiniNumber(128n);
      expect(bytesToHex(result)).toBe('0x00020080');
    });

    it('should encode 255 with leading zero', () => {
      const result = writeMiniNumber(255n);
      expect(bytesToHex(result)).toBe('0x000200ff');
    });

    it('should encode 256 correctly', () => {
      const result = writeMiniNumber(256n);
      expect(bytesToHex(result)).toBe('0x00020100');
    });

    it('should encode 36000 matching Java example', () => {
      const result = writeMiniNumber(36000n);
      expect(bytesToHex(result)).toBe('0x0003008ca0');
    });

    it('should encode with scale=4 for decimal values', () => {
      const result = writeMiniNumber(1n, 4);
      expect(bytesToHex(result)).toBe('0x040101');
    });

    it('should throw for negative values', () => {
      expect(() => writeMiniNumber(-1n)).toThrow();
    });
  });

  describe('writeMiniString', () => {
    it('should encode empty string with 4-byte zero length', () => {
      const result = writeMiniString('');
      expect(bytesToHex(result)).toBe('0x00000000');
    });

    it('should encode "A" as UTF-8', () => {
      const result = writeMiniString('A');
      expect(bytesToHex(result)).toBe('0x0000000141');
    });

    it('should encode "RETURN TRUE" correctly', () => {
      const result = writeMiniString('RETURN TRUE');
      const expected = new TextEncoder().encode('RETURN TRUE');
      expect(result.length).toBe(4 + expected.length);
    });

    it('should encode bracketed string correctly', () => {
      const result = writeMiniString('[hello]');
      const expected = new TextEncoder().encode('[hello]');
      expect(result.length).toBe(4 + expected.length);
    });
  });

  describe('writeHashToStream', () => {
    it('should use MiniData format (same as writeMiniData)', () => {
      const hash = new Uint8Array(32).fill(0xab);
      const result1 = writeHashToStream(hash);
      const result2 = writeMiniData(hash);
      expect(bytesToHex(result1)).toBe(bytesToHex(result2));
    });
  });

  describe('writeMMREntryNumber', () => {
    it('should encode zero with MiniNumber(scale=0) + MiniData(0x00)', () => {
      const result = writeMMREntryNumber(0n);
      expect(bytesToHex(result)).toBe('0x0001000000000100');
    });

    it('should encode 1 correctly', () => {
      const result = writeMMREntryNumber(1n);
      expect(bytesToHex(result)).toBe('0x0001000000000101');
    });

    it('should encode 256 correctly', () => {
      const result = writeMMREntryNumber(256n);
      expect(bytesToHex(result)).toBe('0x000100000000020100');
    });

    it('should encode 1310603 (mainnet mmrentry) correctly', () => {
      const result = writeMMREntryNumber(1310603n);
      expect(bytesToHex(result)).toBe('0x0001000000000313ff8b');
    });
  });

  describe('bigIntToByteArray', () => {
    it('should encode 0 as [0x00]', () => {
      const result = bigIntToByteArray(0n);
      expect(bytesToHex(result)).toBe('0x00');
    });

    it('should add leading zero for values with high bit set', () => {
      const result = bigIntToByteArray(128n);
      expect(bytesToHex(result)).toBe('0x0080');
    });

    it('should not add leading zero when high bit is clear', () => {
      const result = bigIntToByteArray(127n);
      expect(bytesToHex(result)).toBe('0x7f');
    });
  });
});

describe('StateVariable Serialization', () => {
  describe('BOOL type', () => {
    it('should serialize true as port + type=8 + 0x01', () => {
      const sv: StateVariableValue = { port: 0, value: true, type: 'bool' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x000801');
    });

    it('should serialize false as port + type=8 + 0x00', () => {
      const sv: StateVariableValue = { port: 0, value: false, type: 'bool' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x000800');
    });

    it('should serialize "TRUE" string as true', () => {
      const sv: StateVariableValue = { port: 5, value: 'TRUE', type: 'bool' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x050801');
    });

    it('should serialize "false" string (lowercase) as false', () => {
      const sv: StateVariableValue = { port: 10, value: 'false', type: 'bool' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x0a0800');
    });
  });

  describe('NUMBER type', () => {
    it('should serialize 0 with MiniNumber format', () => {
      const sv: StateVariableValue = { port: 0, value: 0n, type: 'number' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x0002000100');
    });

    it('should serialize bigint value', () => {
      const sv: StateVariableValue = { port: 1, value: 100n, type: 'number' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x0102000164');
    });

    it('should serialize string number value', () => {
      const sv: StateVariableValue = { port: 2, value: '42', type: 'number' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x020200012a');
    });

    it('should serialize large number correctly', () => {
      const sv: StateVariableValue = { port: 0, value: 36000n, type: 'number' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x00020003008ca0');
    });
  });

  describe('HEX type', () => {
    it('should serialize hex string with MiniData format', () => {
      const sv: StateVariableValue = { port: 0, value: '0xabcd', type: 'hex' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x000100000002abcd');
    });

    it('should normalize hex without 0x prefix', () => {
      const sv: StateVariableValue = { port: 0, value: 'abcd', type: 'hex' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x000100000002abcd');
    });

    it('should serialize Uint8Array directly', () => {
      const sv: StateVariableValue = { port: 0, value: new Uint8Array([0x12, 0x34]), type: 'hex' };
      const result = writeStateVariable(sv);
      expect(bytesToHex(result)).toBe('0x0001000000021234');
    });

    it('should handle 32-byte address', () => {
      const addr = '0x' + 'ab'.repeat(32);
      const sv: StateVariableValue = { port: 0, value: addr, type: 'hex' };
      const result = writeStateVariable(sv);
      expect(result.length).toBe(1 + 1 + 4 + 32);
    });
  });

  describe('STRING type', () => {
    it('should add brackets to string value', () => {
      const sv: StateVariableValue = { port: 0, value: 'hello', type: 'string' };
      const result = writeStateVariable(sv);
      const expected = new TextEncoder().encode('[hello]');
      expect(result.length).toBe(1 + 1 + 4 + expected.length);
    });

    it('should not double-bracket already bracketed string', () => {
      const sv: StateVariableValue = { port: 0, value: '[hello]', type: 'string' };
      const result = writeStateVariable(sv);
      const expected = new TextEncoder().encode('[hello]');
      expect(result.length).toBe(1 + 1 + 4 + expected.length);
    });

    it('should handle empty string with brackets', () => {
      const sv: StateVariableValue = { port: 0, value: '', type: 'string' };
      const result = writeStateVariable(sv);
      const expected = new TextEncoder().encode('[]');
      expect(result.length).toBe(1 + 1 + 4 + expected.length);
    });
  });

  describe('Port validation', () => {
    it('should accept port 0', () => {
      const sv: StateVariableValue = { port: 0, value: true, type: 'bool' };
      expect(() => writeStateVariable(sv)).not.toThrow();
    });

    it('should accept port 255', () => {
      const sv: StateVariableValue = { port: 255, value: true, type: 'bool' };
      expect(() => writeStateVariable(sv)).not.toThrow();
    });

    it('should reject port < 0', () => {
      const sv: StateVariableValue = { port: -1, value: true, type: 'bool' };
      expect(() => writeStateVariable(sv)).toThrow();
    });

    it('should reject port > 255', () => {
      const sv: StateVariableValue = { port: 256, value: true, type: 'bool' };
      expect(() => writeStateVariable(sv)).toThrow();
    });
  });

  describe('Type constants', () => {
    it('should have correct type values', () => {
      expect(STATETYPE_HEX).toBe(1);
      expect(STATETYPE_NUMBER).toBe(2);
      expect(STATETYPE_STRING).toBe(4);
      expect(STATETYPE_BOOL).toBe(8);
    });
  });
});

describe('Hex Utilities', () => {
  describe('hexToBytes', () => {
    it('should handle 0x prefix', () => {
      const result = hexToBytes('0xabcd');
      expect(result).toEqual(new Uint8Array([0xab, 0xcd]));
    });

    it('should handle no prefix', () => {
      const result = hexToBytes('abcd');
      expect(result).toEqual(new Uint8Array([0xab, 0xcd]));
    });

    it('should handle empty string', () => {
      const result = hexToBytes('0x');
      expect(result.length).toBe(0);
    });

    it('should throw on odd-length hex', () => {
      expect(() => hexToBytes('0xabc')).toThrow();
    });
  });

  describe('bytesToHex', () => {
    it('should produce 0x prefixed output', () => {
      const result = bytesToHex(new Uint8Array([0xab, 0xcd]));
      expect(result).toBe('0xabcd');
    });

    it('should pad single digits with zero', () => {
      const result = bytesToHex(new Uint8Array([0x0a, 0x0b]));
      expect(result).toBe('0x0a0b');
    });

    it('should handle empty array', () => {
      const result = bytesToHex(new Uint8Array(0));
      expect(result).toBe('0x');
    });
  });
});

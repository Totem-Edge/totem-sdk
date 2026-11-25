/**
 * Minima state-variable encoding is consensus-critical: a wrong port/type byte
 * or length prefix silently changes the coin a recipient gets. Pin the byte
 * layout against Java StateVariable.writeDataStream().
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeStateVariable,
  serializeStateVariables,
} from '../src/core/stateSerialization.ts';
import { parseStateVariablesJson } from '../src/core/stateVariables.ts';

const hex = (bytes) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

test('string variable: [port][4][MiniData utf8]', () => {
  assert.equal(
    hex(serializeStateVariable({ port: 1, type: 'string', value: 'abc' })),
    '010400000003616263',
  );
});

test('number variable: [port][2][MiniNumber]', () => {
  assert.equal(
    hex(serializeStateVariable({ port: 2, type: 'number', value: '42' })),
    '020200012a',
  );
});

test('bool variable: [port][8][MiniByte]', () => {
  assert.equal(
    hex(serializeStateVariable({ port: 3, type: 'bool', value: true })),
    '030801',
  );
});

test('hex variable: [port][1][MiniData 32 bytes]', () => {
  const value = `0x${'aa'.repeat(32)}`;
  assert.equal(
    hex(serializeStateVariable({ port: 0, type: 'hex', value })),
    `000100000020${'aa'.repeat(32)}`,
  );
});

test('state list prefixes the count as MiniNumber', () => {
  const bytes = serializeStateVariables([
    { port: 0, type: 'string', value: 'x' },
    { port: 4, type: 'bool', value: false },
  ]);
  assert.equal(hex(bytes).slice(0, 6), '000102'); // count = 2
  assert.equal(hex(bytes).slice(6, 20), '00040000000178'); // string 'x'
  assert.equal(hex(bytes).slice(20), '040800'); // false
});

test('hex state values may be any even-length payload', () => {
  assert.equal(
    hex(serializeStateVariable({ port: 0, type: 'hex', value: '0x1234' })),
    '0001000000021234',
  );
  assert.throws(
    () => serializeStateVariable({ port: 0, type: 'hex', value: '0x123' }),
    /odd length/,
  );
});

test('parseStateVariablesJson validates the array shape', () => {
  assert.deepEqual(
    parseStateVariablesJson('[{"port":0,"type":"number","value":7}]', 'state'),
    [{ port: 0, type: 'number', value: '7' }],
  );
  assert.equal(parseStateVariablesJson('', 'state'), undefined);
  assert.throws(() => parseStateVariablesJson('{}', 'state'), /must be an array/);
  assert.throws(
    () => parseStateVariablesJson('[{"port":300,"type":"bool","value":true}]', 'state'),
    /port must be an integer 0-255/,
  );
});

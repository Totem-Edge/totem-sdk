/**
 * RFC-011 Phase G — standards mapping adapters.
 */

import {
  toIsa95Path,
  parseIsa95Path,
  formatModbusEndpoint,
  parseModbusEndpoint,
  formatOpcuaNodeId,
  parseOpcuaNodeId,
  formatSparkplugTopic,
  parseSparkplugTopic,
  formatBacnetAddress,
  parseBacnetAddress,
} from '../standards.js';

describe('ISA-95 (RFC-011 §4.10)', () => {
  it('round-trips the resource hierarchy', () => {
    expect(toIsa95Path({ site: 'plant-1', asset: 'PLC-1' })).toBe('plant-1/PLC-1');
    expect(toIsa95Path({ site: 'plant-1', area: 'hvac', asset: 'AHU-03', point: 'setpoint' })).toBe(
      'plant-1/hvac/AHU-03/setpoint',
    );
    expect(parseIsa95Path('plant-1/PLC-1')).toEqual({ site: 'plant-1', asset: 'PLC-1' });
    expect(parseIsa95Path('plant-1/hvac/AHU-03')).toEqual({ site: 'plant-1', area: 'hvac', asset: 'AHU-03' });
    expect(parseIsa95Path('plant-1/hvac/AHU-03/setpoint')).toEqual({
      site: 'plant-1',
      area: 'hvac',
      asset: 'AHU-03',
      point: 'setpoint',
    });
    expect(() => parseIsa95Path('only-site')).toThrow(/invalid ISA-95/);
  });
});

describe('Modbus (RFC-011 §4.10)', () => {
  it('round-trips register endpoints', () => {
    expect(formatModbusEndpoint({ registerType: 'holding', address: 40001 })).toBe('holding:40001');
    expect(parseModbusEndpoint('input:30005')).toEqual({ registerType: 'input', address: 30005 });
    expect(() => parseModbusEndpoint('holding:nope')).toThrow(/invalid Modbus/);
  });
});

describe('OPC-UA (RFC-011 §4.10)', () => {
  it('round-trips node ids', () => {
    const node = { namespace: 2, identifierType: 's' as const, identifier: 'AHU03.Setpoint' };
    expect(formatOpcuaNodeId(node)).toBe('ns=2;s=AHU03.Setpoint');
    expect(parseOpcuaNodeId('ns=2;s=AHU03.Setpoint')).toEqual(node);
    expect(parseOpcuaNodeId('ns=3;i=1001')).toEqual({ namespace: 3, identifierType: 'i', identifier: '1001' });
    expect(() => parseOpcuaNodeId('AHU03')).toThrow(/invalid OPC-UA/);
  });
});

describe('Sparkplug B (RFC-011 §4.10)', () => {
  it('round-trips UNS topics', () => {
    const topic = { groupId: 'plant-1', messageType: 'DDATA' as const, edgeNodeId: 'GW-1', deviceId: 'AHU-03', metric: 'setpoint' };
    expect(formatSparkplugTopic(topic)).toBe('spBv1.0/plant-1/DDATA/GW-1/AHU-03/setpoint');
    expect(parseSparkplugTopic('spBv1.0/plant-1/DDATA/GW-1/AHU-03/setpoint')).toEqual(topic);

    const nodeOnly = { groupId: 'g', messageType: 'NBIRTH' as const, edgeNodeId: 'e' };
    expect(formatSparkplugTopic(nodeOnly)).toBe('spBv1.0/g/NBIRTH/e');
    expect(parseSparkplugTopic('spBv1.0/g/NBIRTH/e')).toEqual(nodeOnly);
    expect(() => parseSparkplugTopic('not/sparkplug')).toThrow(/invalid Sparkplug/);
  });
});

describe('BACnet (RFC-011 §4.10)', () => {
  it('round-trips object addresses', () => {
    expect(formatBacnetAddress({ objectType: 'analogOutput', instance: 3 })).toBe('analogOutput,3');
    expect(formatBacnetAddress({ objectType: 'analogOutput', instance: 3, property: 'presentValue' })).toBe(
      'analogOutput,3,presentValue',
    );
    expect(parseBacnetAddress('analogOutput,3,presentValue')).toEqual({
      objectType: 'analogOutput',
      instance: 3,
      property: 'presentValue',
    });
    expect(() => parseBacnetAddress('bad')).toThrow(/invalid BACnet/);
  });
});

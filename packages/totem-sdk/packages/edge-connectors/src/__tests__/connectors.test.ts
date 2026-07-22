import {
  createBacnetGateway,
  createBleGateway,
  createCanGateway,
  createCoapGateway,
  createGrpcGateway,
  createLorawanGateway,
  createMatterGateway,
  createModbusGateway,
  createOpcuaGateway,
  createRos2Gateway,
  createBacnetSensorBridge,
  createBleSensorBridge,
  createCanSensorBridge,
  createCoapSensorBridge,
  createGrpcSensorBridge,
  createLorawanSensorBridge,
  createMatterSensorBridge,
  createModbusSensorBridge,
  createOpcuaSensorBridge,
  createRos2SensorBridge,
} from '../index.js';

describe('gateway factories', () => {
  it('createBacnetGateway returns gateway with status', () => {
    const gw = createBacnetGateway({} as any);
    expect(gw.status).toBe('stopped');
    expect(typeof gw.start).toBe('function');
    expect(typeof gw.stop).toBe('function');
  });

  it('createBleGateway returns gateway with status and peripherals', () => {
    const gw = createBleGateway({} as any);
    expect(gw.status).toBe('stopped');
    expect(gw.peripherals).toEqual([]);
  });

  it('createCanGateway returns gateway with send', () => {
    const gw = createCanGateway({} as any);
    expect(gw.status).toBe('stopped');
    expect(typeof gw.send).toBe('function');
  });

  it('createCoapGateway returns gateway with get/post', () => {
    const gw = createCoapGateway({} as any);
    expect(gw.status).toBe('stopped');
    expect(typeof gw.get).toBe('function');
    expect(typeof gw.post).toBe('function');
  });

  it('createGrpcGateway returns gateway with call', () => {
    const gw = createGrpcGateway({} as any);
    expect(gw.status).toBe('stopped');
    expect(typeof gw.call).toBe('function');
  });

  it('createLorawanGateway returns gateway with sendConfirmed/sendUnconfirmed', () => {
    const gw = createLorawanGateway({} as any);
    expect(gw.status).toBe('stopped');
    expect(typeof gw.sendConfirmed).toBe('function');
    expect(typeof gw.sendUnconfirmed).toBe('function');
  });

  it('createMatterGateway returns gateway with commission/read/write/invoke', () => {
    const gw = createMatterGateway({} as any);
    expect(gw.status).toBe('stopped');
    expect(typeof gw.commission).toBe('function');
    expect(typeof gw.readAttribute).toBe('function');
  });

  it('createModbusGateway returns gateway with register access', () => {
    const gw = createModbusGateway({} as any);
    expect(gw.status).toBe('stopped');
    expect(typeof gw.readHoldingRegisters).toBe('function');
  });

  it('createOpcuaGateway returns gateway with browse/read/write', () => {
    const gw = createOpcuaGateway({} as any);
    expect(gw.status).toBe('stopped');
    expect(typeof gw.browse).toBe('function');
    expect(typeof gw.readVariable).toBe('function');
  });

  it('createRos2Gateway returns gateway with publish/callService', () => {
    const gw = createRos2Gateway({} as any);
    expect(gw.status).toBe('stopped');
    expect(typeof gw.publish).toBe('function');
    expect(typeof gw.callService).toBe('function');
  });
});

describe('sensor bridge factories', () => {
  it('createBacnetSensorBridge returns bridge with start/stop/poll', () => {
    const b = createBacnetSensorBridge({} as any);
    expect(typeof b.start).toBe('function');
    expect(typeof b.stop).toBe('function');
    expect(typeof b.poll).toBe('function');
  });

  it('createBleSensorBridge returns bridge with start/stop/poll', () => {
    const b = createBleSensorBridge({} as any);
    expect(typeof b.start).toBe('function');
    expect(typeof b.poll).toBe('function');
  });

  it('createCanSensorBridge returns bridge', () => {
    const b = createCanSensorBridge({} as any);
    expect(typeof b.start).toBe('function');
  });

  it('createCoapSensorBridge returns bridge', () => {
    const b = createCoapSensorBridge({} as any);
    expect(typeof b.poll).toBe('function');
  });

  it('createGrpcSensorBridge returns bridge', () => {
    const b = createGrpcSensorBridge({} as any);
    expect(typeof b.poll).toBe('function');
  });

  it('createLorawanSensorBridge returns bridge', () => {
    const b = createLorawanSensorBridge({} as any);
    expect(typeof b.poll).toBe('function');
  });

  it('createMatterSensorBridge returns bridge', () => {
    const b = createMatterSensorBridge({} as any);
    expect(typeof b.poll).toBe('function');
  });

  it('createModbusSensorBridge returns bridge', () => {
    const b = createModbusSensorBridge({} as any);
    expect(typeof b.poll).toBe('function');
  });

  it('createOpcuaSensorBridge returns bridge', () => {
    const b = createOpcuaSensorBridge({} as any);
    expect(typeof b.poll).toBe('function');
  });

  it('createRos2SensorBridge returns bridge', () => {
    const b = createRos2SensorBridge({} as any);
    expect(typeof b.start).toBe('function');
  });
});

describe('root index exports', () => {
  it('exports all expected names', () => {
    const mod = require('../index');
    const expected = [
      'createBacnetGateway', 'createBacnetSensorBridge',
      'createBleGateway', 'createBleSensorBridge',
      'createCanGateway', 'createCanSensorBridge',
      'createCoapGateway', 'createCoapSensorBridge',
      'createGrpcGateway', 'createGrpcSensorBridge',
      'createLorawanGateway', 'createLorawanSensorBridge',
      'createMatterGateway', 'createMatterSensorBridge',
      'createModbusGateway', 'createModbusSensorBridge',
      'createOpcuaGateway', 'createOpcuaSensorBridge',
      'createRos2Gateway', 'createRos2SensorBridge',
    ];
    for (const sym of expected) {
      expect(typeof mod[sym]).toBe('function');
    }
  });
});

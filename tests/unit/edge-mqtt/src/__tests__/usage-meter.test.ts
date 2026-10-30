import { createMqttUsageMeter } from '../usage-meter.js';
import { createEdgeRuntime, createCapabilitySet } from '@totemsdk/edge';
import type { MqttUsageEvent } from '../types.js';

function makeRuntime() {
  return createEdgeRuntime({
    deviceId: 'usage-test',
    capabilities: createCapabilitySet([]),
    ports: {},
  });
}

const makeEvent = (unit: MqttUsageEvent['unit'], quantity = '1'): MqttUsageEvent => ({
  eventId: `ev-${Date.now()}`,
  deviceId: 'usage-test',
  unit,
  quantity,
  createdAt: Date.now(),
});

describe('usage-meter.test — record/receipt for all unit types', () => {
  it('recordUsage tracks message usage', async () => {
    const meter = createMqttUsageMeter({ runtime: makeRuntime(), deviceId: 'usage-test' });
    const result = await meter.recordUsage(makeEvent('message'));
    expect(result.ok).toBe(true);
    expect(meter.getUnpaidUsage()).toBe('1');
  });

  it('recordUsage accumulates multiple events', async () => {
    const meter = createMqttUsageMeter({ runtime: makeRuntime(), deviceId: 'usage-test' });
    await meter.recordUsage(makeEvent('byte', '100'));
    await meter.recordUsage(makeEvent('byte', '200'));
    expect(parseFloat(meter.getUnpaidUsage())).toBeCloseTo(300);
  });

  it('resetUsage resets to 0', async () => {
    const meter = createMqttUsageMeter({ runtime: makeRuntime(), deviceId: 'usage-test' });
    await meter.recordUsage(makeEvent('reading', '5'));
    meter.resetUsage();
    expect(meter.getUnpaidUsage()).toBe('0');
  });

  it('createUsageReceipt returns EdgeReceipt with usage data', async () => {
    const meter = createMqttUsageMeter({ runtime: makeRuntime(), deviceId: 'usage-test' });
    const event = makeEvent('kwh', '2.5');
    await meter.recordUsage(event);
    const receipt = meter.createUsageReceipt(event);
    expect(receipt.receiptId).toBeDefined();
    expect(receipt.kind).toBe('mqtt:usage');
    expect(receipt.payload.unit).toBe('kwh');
    expect(receipt.payload.quantity).toBe('2.5');
  });

  it('supports all 8 MqttUsageUnit types', async () => {
    const units: MqttUsageEvent['unit'][] = [
      'message', 'byte', 'second', 'minute', 'kwh', 'reading', 'command', 'custom',
    ];
    const meter = createMqttUsageMeter({ runtime: makeRuntime(), deviceId: 'usage-test' });
    for (const unit of units) {
      const result = await meter.recordUsage(makeEvent(unit));
      expect(result.ok).toBe(true);
    }
  });
});

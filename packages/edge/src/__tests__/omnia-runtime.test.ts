import { createEdgeRuntime } from '../runtime.js';
import { createCapabilitySet } from '../capabilities.js';

describe('Edge Omnia actions', () => {
  it('routes omnia actions through the injected port', async () => {
    const getChannels = jest.fn(async () => ({ ok: true, data: { channels: [] } }));
    const runtime = createEdgeRuntime({
      deviceId: 'device-1',
      capabilities: createCapabilitySet(['omnia:channels']),
      ports: { omnia: {
        getChannels,
        openChannel: jest.fn(), pay: jest.fn(), settle: jest.fn(), closeChannel: jest.fn(),
        getRoute: jest.fn(), payMultiHop: jest.fn(), getSwapRate: jest.fn(),
        createFactory: jest.fn(), openVirtualChannel: jest.fn(), closeFactory: jest.fn(),
        spliceIn: jest.fn(), spliceOut: jest.fn(),
      } },
    });

    await expect(runtime.executeAction({ action: 'omnia:getChannels', subject: 'origin-1' })).resolves.toMatchObject({ ok: true });
    expect(getChannels).toHaveBeenCalledWith({ subject: 'origin-1' });
  });
});

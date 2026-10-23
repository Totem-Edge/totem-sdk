import { HyperswarmManager } from '../hyperswarm-manager.js';

/**
 * D1 / RFC-057 Phase 0: current Hyperswarm uses `{ server, client }`, not the
 * legacy `{ announce, lookup }` names. The manager must map the config
 * explicitly so disabling announcement/lookup actually does what the caller
 * asked.
 */
describe('HyperswarmManager topic join (D1)', () => {
  it('maps announce/lookup onto server/client', async () => {
    const joins: Array<{ topic: unknown; options: unknown }> = [];
    const swarm = {
      on: () => undefined,
      join: async (topic: unknown, options: unknown) => {
        joins.push({ topic, options });
      },
      flush: async () => undefined,
      leave: async () => undefined,
      destroy: async () => undefined,
    };
    const node = { handleConnection: () => undefined };

    const manager = new HyperswarmManager(node as never, {
      swarm,
      topic: 'totem-lookup-v1',
      announce: true,
      lookup: false,
    });
    await manager.start();

    expect(joins).toHaveLength(1);
    expect(joins[0]!.options).toEqual({ server: true, client: false });
    await manager.stop();
  });

  it('defaults to announcing and looking up', async () => {
    const joins: Array<{ options: unknown }> = [];
    const swarm = {
      on: () => undefined,
      join: async (_topic: unknown, options: unknown) => {
        joins.push({ options });
      },
      flush: async () => undefined,
      leave: async () => undefined,
      destroy: async () => undefined,
    };
    const manager = new HyperswarmManager({ handleConnection: () => undefined } as never, {
      swarm,
      topic: 'totem-lookup-v1',
    });
    await manager.start();
    expect(joins[0]!.options).toEqual({ server: true, client: true });
    await manager.stop();
  });
});

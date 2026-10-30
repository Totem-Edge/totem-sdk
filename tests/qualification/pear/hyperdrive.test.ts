import { EventEmitter } from 'node:events';
import {
  BareHyperdriveAdapter,
  loadManifest,
  openRemoteDrive,
} from '../hyperdrive';

const ROOT_KEY = 'a'.repeat(64);
const ROOT_BUF = Buffer.from(ROOT_KEY, 'hex');
const DISCOVERY_KEY = Buffer.alloc(32, 7);

class FakeSwarm extends EventEmitter {
  joinedTopic: Buffer | null = null;
  joinOpts: unknown = null;
  flush = jest.fn(async () => {});
  destroy = jest.fn(async () => {});
  join = jest.fn((topic: Buffer, opts: unknown) => {
    this.joinedTopic = topic;
    this.joinOpts = opts;
    return { flushed: jest.fn(async () => {}), destroy: jest.fn(async () => {}) };
  });
}

class FakeCorestore {
  replicate = jest.fn();
  close = jest.fn(async () => {});
}

class FakeHyperdrive {
  static last: FakeHyperdrive | null = null;
  discoveryKey = DISCOVERY_KEY;
  ready = jest.fn(async () => {});
  close = jest.fn(async () => {});
  get = jest.fn(async () => new TextEncoder().encode('{not json'));
  put = jest.fn(async () => {});
  list = jest.fn(() => (async function* () {})());
  watch = jest.fn();
  constructor(readonly store: unknown, readonly key?: Buffer) {
    FakeHyperdrive.last = this;
  }
}

function makeDeps(swarm: FakeSwarm, store: FakeCorestore) {
  return {
    // `new` on a function that returns an object yields that object.
    Hyperswarm: function FakeSwarmCtor() { return swarm; } as unknown as new () => never,
    Corestore: function FakeCorestoreCtor() { return store; } as unknown as new (path: string) => never,
    Hyperdrive: FakeHyperdrive as unknown as new (store: unknown, key?: Buffer) => never,
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('openRemoteDrive', () => {
  it('joins discoveryKey and waits for a peer instead of flush()', async () => {
    const swarm = new FakeSwarm();
    const store = new FakeCorestore();
    const drivePromise = openRemoteDrive(ROOT_KEY, {
      connectTimeoutMs: 40,
      _deps: makeDeps(swarm, store),
    });

    await tick();

    expect(swarm.joinedTopic).toEqual(DISCOVERY_KEY);
    expect(swarm.joinedTopic).not.toEqual(ROOT_BUF);
    expect(swarm.joinOpts).toEqual({ client: true, server: false });
    // flush() resolving must not be treated as readiness.
    expect(swarm.flush).not.toHaveBeenCalled();

    await expect(drivePromise).rejects.toThrow(/no peers/);
    expect(swarm.destroy).toHaveBeenCalledTimes(1);
    expect(store.close).toHaveBeenCalledTimes(1);
  });

  it('resolves on a real connection and closes swarm/store', async () => {
    const swarm = new FakeSwarm();
    const store = new FakeCorestore();
    const drivePromise = openRemoteDrive(ROOT_KEY, {
      connectTimeoutMs: 1000,
      _deps: makeDeps(swarm, store),
    });

    await tick();
    const conn = { id: 'peer-1' };
    swarm.emit('connection', conn);

    const adapter = await drivePromise;
    expect(store.replicate).toHaveBeenCalledWith(conn);

    await adapter.close();
    expect(swarm.destroy).toHaveBeenCalledTimes(1);
    expect(store.close).toHaveBeenCalledTimes(1);
  });
});

describe('loadManifest', () => {
  it('fails closed on invalid JSON and still closes an owned drive', async () => {
    const close = jest.fn(async () => {});
    const adapter = {
      readFile: async () => new TextEncoder().encode('{not json'),
      writeFile: async () => {},
      list: async () => [],
      watch: () => () => {},
      close,
    };

    await expect(loadManifest(ROOT_KEY, adapter)).rejects.toThrow(/not valid JSON/);
    // Caller-supplied adapters are not owned, so loadManifest must not close them.
    expect(close).not.toHaveBeenCalled();
  });

  it('rejects a non-SignedManifest envelope', async () => {
    const close = jest.fn(async () => {});
    const adapter = {
      readFile: async () => new TextEncoder().encode(JSON.stringify({ name: 'x' })),
      writeFile: async () => {},
      list: async () => [],
      watch: () => () => {},
      close,
    };

    await expect(loadManifest(ROOT_KEY, adapter)).rejects.toThrow(/not a SignedManifest/);
    expect(close).not.toHaveBeenCalled();
  });

  it('rejects a structurally valid envelope with an invalid signature', async () => {
    const adapter = {
      readFile: async () => new TextEncoder().encode(JSON.stringify({
        manifest: { type: 'app', name: 'x', version: '1.0.0', authorAddress: 'Mx1' },
        authorAddress: 'Mx1',
        signerPublicKey: 'aa'.repeat(32),
        signedAt: 1,
        signature: 'bb'.repeat(64),
      })),
      writeFile: async () => {},
      list: async () => [],
      watch: () => () => {},
    };

    await expect(loadManifest(ROOT_KEY, adapter)).rejects.toThrow(/verification failed/);
  });
});

describe('loadManifest ownership', () => {
  it('closes a drive it opened, even when verification fails', async () => {
    const swarm = new FakeSwarm();
    const store = new FakeCorestore();
    const pending = loadManifest(ROOT_KEY, undefined, {
      connectTimeoutMs: 1000,
      _deps: makeDeps(swarm, store),
    });

    await tick();
    swarm.emit('connection', { id: 'peer-owned' });

    await expect(pending).rejects.toThrow(/not valid JSON/);
    expect(FakeHyperdrive.last?.close).toHaveBeenCalledTimes(1);
    expect(store.close).toHaveBeenCalledTimes(1);
  });
});

describe('BareHyperdriveAdapter.watch', () => {
  it('uses the async watcher and stops on unsubscribe', async () => {
    const control: { deliver: ((value: unknown) => void) | null } = { deliver: null };
    let stopped = false;
    const watcher = {
      destroy: jest.fn(() => {
        stopped = true;
        control.deliver?.({ value: undefined, done: true });
      }),
      [Symbol.asyncIterator]() {
        return {
          next: () => stopped
            ? Promise.resolve({ value: undefined, done: true })
            : new Promise((resolve) => {
                control.deliver = resolve;
              }),
        };
      },
    };
    const drive = {
      get: async () => null,
      put: async () => {},
      list: function () { return (async function* () {})(); },
      watch: jest.fn(() => watcher),
    };
    const adapter = new BareHyperdriveAdapter(drive);
    const seen: string[] = [];
    const unsubscribe = adapter.watch('/app', (changed) => seen.push(changed));

    control.deliver?.({ value: [{ key: '/app/index.js' }, null], done: false });
    await tick();
    expect(seen).toEqual(['/app/index.js']);
    expect(drive.watch).toHaveBeenCalledWith('/app');

    unsubscribe();
    expect(watcher.destroy).toHaveBeenCalled();
  });
});

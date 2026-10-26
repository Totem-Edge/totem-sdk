/**
 * @totemsdk/pear — Hyperdrive adapter + manifest loading
 *
 * `HyperdriveAdapter` is the interface Totem marketplace code uses to read
 * app bundles from a Pear topic key. `BareHyperdriveAdapter` wraps a real
 * Hyperdrive instance. `loadManifest` reads and verifies `manifest.json` from a
 * remote Hyperdrive identified by its 64-hex `pearTopicKey` public key.
 *
 * How remote drive access works:
 *   1. A Corestore caches replicated blocks locally.
 *   2. Hyperdrive is opened from the Corestore with the root core public key.
 *   3. A Hyperswarm instance joins `drive.discoveryKey` (dir 0), not the root
 *      core key — joining the root key discovers the wrong topic.
 *   4. Peers are streamed into `store.replicate()`; the drive replicates lazily.
 *   5. Readiness means at least one peer connection, not `swarm.flush()`.
 *
 * Bare-compatible: no `process.env`, no `__dirname`, no `require`.
 * All Holepunch packages are loaded via dynamic import so the module is
 * importable in environments where they are absent.
 */

import { verifyManifest } from '@totemsdk/manifest';
import type { SignedManifest } from '@totemsdk/manifest';

export type { SignedManifest } from '@totemsdk/manifest';

export interface HyperdriveAdapter {
  /** Read a file from the drive. */
  readFile(path: string): Promise<Uint8Array>;
  /** Write or overwrite a file in the drive. */
  writeFile(path: string, data: Uint8Array): Promise<void>;
  /** List files under a prefix path. */
  list(path?: string): Promise<string[]>;
  /** Watch a path for changes. Returns an unsubscribe function. */
  watch(path: string, cb: (changedPath: string) => void): () => void;
}

export interface RemoteDriveOptions {
  /** Corestore base directory for replicated blocks. */
  storagePath?: string;
  /** How long to wait for the first peer connection. Default: 20_000 ms. */
  connectTimeoutMs?: number;
  /** @internal dependency injection for tests. */
  _deps?: RemoteDriveDeps;
}

/** @internal test seam; production callers omit this. */
export interface RemoteDriveDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Hyperswarm?: new () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Hyperdrive?: new (store: unknown, key?: Buffer) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Corestore?: new (path: string) => any;
}

/**
 * Wraps a real Hyperdrive instance (or a duck-typed test double) as a
 * `HyperdriveAdapter`.
 */
export class BareHyperdriveAdapter implements HyperdriveAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly _drive: any) {}

  async readFile(path: string): Promise<Uint8Array> {
    const buf: Buffer | null = await this._drive.get(path);
    if (buf === null) throw new Error(`BareHyperdriveAdapter: file not found: ${path}`);
    return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    await this._drive.put(path, Buffer.from(data));
  }

  async list(path = '/'): Promise<string[]> {
    const entries: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = this._drive.list(path) as AsyncIterable<{ key: string }>;
    for await (const entry of stream) {
      entries.push(entry.key);
    }
    return entries;
  }

  watch(path: string, cb: (changedPath: string) => void): () => void {
    // Hyperdrive 13 uses an async watcher: `drive.watch(folder)`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const watcher = this._drive.watch(path) as AsyncIterable<[any, any]> & {
      destroy?: () => Promise<void> | void;
    };
    let stopped = false;
    void (async () => {
      try {
        for await (const [current] of watcher) {
          if (stopped) break;
          cb(current?.key ?? path);
        }
      } catch {
        // Destroying the watcher ends the iterator; treat as normal teardown.
      }
    })();
    return () => {
      stopped = true;
      void watcher?.destroy?.();
    };
  }
}

/** Open a **local** Hyperdrive from a Corestore path (no network). */
export async function openLocalDrive(storagePath: string): Promise<BareHyperdriveAdapter> {
  const [{ default: Hyperdrive }, { default: Corestore }] = await Promise.all([
    import('hyperdrive' as string),
    import('corestore' as string),
  ]) as [
    { default: new (store: unknown) => unknown },
    { default: new (path: string) => unknown },
  ];

  const store = new Corestore(storagePath);
  const drive = new Hyperdrive(store);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (drive as any).ready?.();
  return new BareHyperdriveAdapter(drive);
}

/** @internal wait for a real swarm connection (never for `flush()`). */
function waitForPeer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  swarm: any,
  timeoutMs: number,
  topic: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timer);
      swarm.removeListener?.('connection', onConnection);
      swarm.removeListener?.('error', onError);
    };
    const onConnection = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`openRemoteDrive: no peers found for topic ${topic} within ${timeoutMs}ms`));
    }, timeoutMs);

    swarm.on('connection', onConnection);
    swarm.on?.('error', onError);
  });
}

/**
 * Open a **remote** Hyperdrive identified by its 64-hex `pearTopicKey`.
 *
 * Joins `discoveryKey` (not the root core key), waits for an actual peer
 * connection, and destroys the swarm/store if joining times out so a failed
 * attempt cannot leak a swarm.
 */
export async function openRemoteDrive(
  pearTopicKey: string,
  options: RemoteDriveOptions = {},
): Promise<BareHyperdriveAdapter & { close(): Promise<void> }> {
  if (!/^[0-9a-f]{64}$/i.test(pearTopicKey)) {
    throw new TypeError(
      `pearTopicKey must be a 64-hex public key, got: ${JSON.stringify(pearTopicKey)}`,
    );
  }

  const storagePath = options.storagePath ?? `./.pear-drives/${pearTopicKey}`;
  const connectTimeoutMs = options.connectTimeoutMs ?? 20_000;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let HyperswarmCtor: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let HyperdriveCtor: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let CorestoreCtor: any;
  if (options._deps) {
    HyperswarmCtor = options._deps.Hyperswarm;
    HyperdriveCtor = options._deps.Hyperdrive;
    CorestoreCtor = options._deps.Corestore;
  } else {
    [{ default: HyperswarmCtor }, { default: HyperdriveCtor }, { default: CorestoreCtor }] =
      await Promise.all([
        import('hyperswarm' as string),
        import('hyperdrive' as string),
        import('corestore' as string),
      ]);
  }
  if (!HyperswarmCtor || !HyperdriveCtor || !CorestoreCtor) {
    throw new Error('openRemoteDrive: missing Holepunch dependencies');
  }

  const store = new CorestoreCtor(storagePath);
  const swarm = new HyperswarmCtor();
  const rootKey = Buffer.from(pearTopicKey, 'hex');

  const onConnection = (conn: unknown): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.replicate(conn);
  };
  swarm.on('connection', onConnection);

  let drive: { discoveryKey?: Buffer; ready?: () => Promise<void>; close?: () => Promise<void> } | undefined;
  let joined: { flushed?: () => Promise<unknown>; destroy?: () => Promise<unknown> | unknown } | null = null;
  try {
    const created = new HyperdriveCtor(store, rootKey) as {
      discoveryKey?: Buffer;
      ready?: () => Promise<void>;
      close?: () => Promise<void>;
    };
    drive = created;
    await created.ready?.();

    if (!created.discoveryKey) {
      throw new Error('openRemoteDrive: Hyperdrive did not expose a discoveryKey');
    }
    joined = swarm.join(created.discoveryKey, { client: true, server: false });
    // `flush()` only flushes discovery announcements; it is not peer readiness.
    void Promise.resolve(joined?.flushed?.()).catch(() => {});

    await waitForPeer(swarm, connectTimeoutMs, pearTopicKey);
  } catch (error) {
    swarm.removeListener?.('connection', onConnection);
    await Promise.resolve(drive?.close?.()).catch(() => {});
    await Promise.resolve(joined?.destroy?.()).catch(() => {});
    await Promise.resolve(swarm.destroy?.()).catch(() => {});
    await Promise.resolve(store.close?.()).catch(() => {});
    throw error;
  }

  if (!drive) throw new Error('openRemoteDrive: drive was not created');
  const adapter = new BareHyperdriveAdapter(drive) as BareHyperdriveAdapter & {
    close(): Promise<void>;
  };
  adapter.close = async () => {
    swarm.removeListener?.('connection', onConnection);
    await Promise.resolve(drive.close?.()).catch(() => {});
    await Promise.resolve(joined?.destroy?.()).catch(() => {});
    await Promise.resolve(swarm.destroy?.()).catch(() => {});
    await Promise.resolve(store.close?.()).catch(() => {});
  };
  return adapter;
}

/**
 * Read and verify `manifest.json` from a remote Hyperdrive.
 *
 * Fails closed:
 * - invalid JSON or a non-SignedManifest envelope throws;
 * - a failed WOTS/author verification throws.
 *
 * When this function opens the drive it also closes it in `finally`.
 */
export async function loadManifest(
  pearTopicKey: string,
  adapter?: HyperdriveAdapter,
  options?: RemoteDriveOptions,
): Promise<SignedManifest> {
  const owned = !adapter;
  const drive = adapter ?? (await openRemoteDrive(pearTopicKey, options));
  try {
    const raw = await drive.readFile('/manifest.json');
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(raw));
    } catch (error) {
      throw new Error(
        `loadManifest: /manifest.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (parsed === null || typeof parsed !== 'object') {
      throw new Error('loadManifest: /manifest.json is not an object');
    }
    const signed = parsed as SignedManifest;
    if (
      !signed.manifest ||
      typeof signed.signature !== 'string' ||
      typeof signed.signerPublicKey !== 'string' ||
      typeof signed.authorAddress !== 'string'
    ) {
      throw new Error('loadManifest: /manifest.json is not a SignedManifest envelope');
    }
    const result = verifyManifest(signed);
    if (!result.valid) {
      throw new Error(
        `loadManifest: manifest verification failed: ${result.reason ?? 'invalid signature'}`,
      );
    }
    return signed;
  } finally {
    if (owned && 'close' in drive && typeof drive.close === 'function') {
      await drive.close();
    }
  }
}

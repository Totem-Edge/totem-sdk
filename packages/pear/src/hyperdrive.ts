/**
 * @totemsdk/pear — Hyperdrive adapter + manifest loading
 *
 * `HyperdriveAdapter` is the interface Totem marketplace code uses to read
 * app bundles from a Pear topic key. `BareHyperdriveAdapter` wraps a real
 * Hyperdrive instance. `loadManifest` reads `manifest.json` from a remote
 * Hyperdrive identified by its 64-hex `pearTopicKey` public key.
 *
 * How remote drive access works:
 *   1. A Hyperswarm instance joins the topic derived from `pearTopicKey`.
 *   2. Incoming connections are plumbed into a Corestore replication stream.
 *   3. Hyperdrive is opened from the Corestore with the topic key as its
 *      root core public key — it replicates lazily from swarm peers.
 *   4. After the drive is `ready` the caller can read files normally.
 *
 * Bare-compatible: no `process.env`, no `__dirname`, no `require`.
 * All Holepunch packages (hyperswarm, hyperdrive, corestore) are loaded via
 * dynamic import so the module is importable in environments where they are
 * absent (error surfaces lazily, only when the drive is first opened).
 */

export interface HyperdriveAdapter {
  /**
   * Read a file from the drive.
   * @param path — absolute path within the drive, e.g. `/manifest.json`
   */
  readFile(path: string): Promise<Uint8Array>;

  /**
   * Write or overwrite a file in the drive.
   * @param path — absolute path within the drive
   * @param data — raw bytes to write
   */
  writeFile(path: string, data: Uint8Array): Promise<void>;

  /**
   * List files under a prefix path.
   * @param path — directory prefix (default: '/')
   */
  list(path?: string): Promise<string[]>;

  /**
   * Watch a path for changes.
   * @returns Unsubscribe function
   */
  watch(path: string, cb: (changedPath: string) => void): () => void;
}

/**
 * A minimal `SignedManifest` shape.
 * The full type is provided by `@totemsdk/app-manifest` when installed.
 * This local definition avoids a hard dependency.
 */
export interface SignedManifest {
  name: string;
  version: string;
  description?: string;
  pearTopicKey?: string;
  [key: string]: unknown;
}

export interface RemoteDriveOptions {
  /**
   * Corestore base directory for persisting replicated blocks locally.
   * Defaults to `'./.pear-drives/<pearTopicKey>'`.
   */
  storagePath?: string;
  /**
   * How long to wait (ms) for at least one peer to join the topic before
   * giving up. Default: 20_000.
   */
  connectTimeoutMs?: number;
}

/**
 * Wraps a real Hyperdrive instance (from the `hyperdrive` npm package) or
 * any duck-typed object as a `HyperdriveAdapter`.
 *
 * Constructor accepts any Hyperdrive-like object so tests can inject mocks.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const watcher = this._drive.watch(path, (diff: any) => {
      cb(diff?.key ?? path);
    });
    return () => watcher?.destroy?.();
  }
}

/**
 * Open a **local** Hyperdrive from a Corestore path (no network required).
 *
 * Useful when the drive content is already replicated locally or when the
 * caller manages replication separately.
 */
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

/**
 * Open a **remote** Hyperdrive identified by its 64-hex `pearTopicKey`.
 *
 * Steps:
 *   1. Creates a Corestore for local block caching.
 *   2. Creates a Hyperswarm and joins the topic derived from `pearTopicKey`.
 *   3. Plumbs each swarm connection into Corestore's replication stream.
 *   4. Opens a Hyperdrive seeded with the public key derived from `pearTopicKey`.
 *   5. Waits for the drive to become `ready` (blocks are fetched from peers).
 *
 * @param pearTopicKey — 64-hex public key of the Hyperdrive's root Hypercore
 * @param options       — optional storage path + connect timeout overrides
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

  const [
    { default: Hyperswarm },
    { default: Hyperdrive },
    { default: Corestore },
  ] = await Promise.all([
    import('hyperswarm' as string),
    import('hyperdrive' as string),
    import('corestore' as string),
  ]) as [
    { default: new () => unknown },
    { default: new (store: unknown, key: Buffer) => unknown },
    { default: new (path: string) => unknown },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = new Corestore(storagePath) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const swarm = new Hyperswarm() as any;

  swarm.on('connection', (conn: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (store as any).replicate(conn);
  });

  const topicBytes = Buffer.from(pearTopicKey, 'hex');
  swarm.join(topicBytes, { client: true, server: false });

  // Wait for at least one peer or timeout
  await Promise.race([
    swarm.flush() as Promise<void>,
    new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error(`openRemoteDrive: no peers found for topic ${pearTopicKey} within ${connectTimeoutMs}ms`)),
        connectTimeoutMs,
      ),
    ),
  ]);

  const keyBuf = Buffer.from(pearTopicKey, 'hex');
  const drive = new Hyperdrive(store, keyBuf);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (drive as any).ready?.();

  const adapter = new BareHyperdriveAdapter(drive) as BareHyperdriveAdapter & {
    close(): Promise<void>;
  };

  adapter.close = async () => {
    await swarm.destroy?.();
    await store.close?.();
  };

  return adapter;
}

/**
 * Load and parse `manifest.json` from a remote Hyperdrive identified by
 * its 64-hex `pearTopicKey`.
 *
 * - Joins Hyperswarm to locate peers for the given topic key.
 * - Reads `/manifest.json` from the replicated drive.
 * - If `@totemsdk/app-manifest` is installed its `decodeManifest` is used
 *   for schema validation; otherwise the raw JSON is returned.
 *
 * Pass a pre-opened `adapter` to skip the network join (useful in tests).
 */
export async function loadManifest(
  pearTopicKey: string,
  adapter?: HyperdriveAdapter,
  options?: RemoteDriveOptions,
): Promise<SignedManifest> {
  const drive = adapter ?? (await openRemoteDrive(pearTopicKey, options));
  const raw = await drive.readFile('/manifest.json');
  const text = new TextDecoder().decode(raw);
  const parsed = JSON.parse(text) as SignedManifest;

  try {
    const { decodeManifest } = await import('@totemsdk/app-manifest' as string) as {
      decodeManifest: (data: unknown) => SignedManifest;
    };
    return decodeManifest(parsed);
  } catch {
    return parsed;
  }
}

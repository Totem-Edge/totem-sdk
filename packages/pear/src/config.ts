/**
 * @totemsdk/pear — Config loading utilities
 *
 * `loadConfig` reads app configuration in the following order:
 *   1. `globalThis.Pear.config` — structured data injected by the Pear runtime
 *      when the app is launched from a Pear link (pear://<key>/<name>). This is
 *      the authoritative Pear config source; no additional network call is made.
 *   2. `pear://config/<appName>` — conventional key name checked inside
 *      `globalThis.Pear.storage` (Pear's local app KV store) when the Pear
 *      runtime is present but `Pear.config` does not carry the app config.
 *   3. `configPath` (file on disk, JSON) — explicit override for non-Pear
 *      environments (Node.js scripts, local dev server, Bare without Pear).
 *   4. Empty default config `{ appName }`.
 *
 * `defaultSwarmConfig()` returns safe defaults for Hyperswarm join options.
 *
 * Bare-compatible: no `process.env`, no `__dirname`, no `require`.
 */

export interface SwarmConfig {
  client: boolean;
  server: boolean;
  timeoutMs: number;
  maxPeers: number;
}

export interface AppConfig {
  appName: string;
  swarm?: Partial<SwarmConfig>;
  [key: string]: unknown;
}

/** Safe defaults for Hyperswarm join options. */
export function defaultSwarmConfig(): SwarmConfig {
  return {
    client: true,
    server: true,
    timeoutMs: 15_000,
    maxPeers: 24,
  };
}

/**
 * Load app configuration.
 *
 * Resolution order:
 *   1. `globalThis.Pear.config` — Pear-runtime-injected config object
 *   2. `pear://config/<appName>` — looked up in `globalThis.Pear.storage`
 *      (Pear's local persistent KV store for the app)
 *   3. `configPath` — JSON file on disk (bare-fs → node:fs fallback)
 *   4. Default: `{ appName }`
 */
export async function loadConfig(
  appName: string,
  configPath?: string,
): Promise<AppConfig> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pear = (globalThis as any).Pear as
    | {
        config?: Record<string, unknown>;
        storage?: {
          get(key: string): Promise<Buffer | Uint8Array | null | undefined>;
        };
      }
    | undefined;

  // Step 1: Pear.config (Pear-runtime-injected structured config)
  if (pear?.config && typeof pear.config === 'object') {
    return { appName, ...pear.config } as AppConfig;
  }

  // Step 2: pear://config/<appName> via Pear.storage
  if (pear?.storage) {
    try {
      const configKey = `pear://config/${appName}`;
      const raw = await pear.storage.get(configKey);
      if (raw && raw.length > 0) {
        const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
        const parsed = JSON.parse(text) as Record<string, unknown>;
        return { appName, ...parsed } as AppConfig;
      }
    } catch {
      // Pear storage not available or key absent — fall through
    }
  }

  // Step 3: JSON file on disk
  if (configPath) {
    try {
      const fs = await import('node:fs').catch(
        () => import('bare-fs' as string) as unknown as Promise<typeof import('node:fs')>,
      ) as unknown as {
        readFileSync(p: string, enc: 'utf-8'): string;
        existsSync(p: string): boolean;
      };

      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return { appName, ...parsed } as AppConfig;
      }
    } catch {
      // Config file unavailable — return defaults
    }
  }

  // Step 4: Default
  return { appName };
}

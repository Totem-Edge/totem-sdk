/**
 * Release/advisory awareness feed (#update-awareness).
 *
 * This module is deliberately non-enforcing: it tells an operator (or a host)
 * that newer package versions and advisories exist. It never installs, never
 * blocks a peer, and never changes behaviour on its own. Enforcement is a
 * separate concern.
 */

export interface ReleaseVersion {
  version: string;
  publishedAt?: string;
  integrity?: string;
  deprecated?: boolean;
}

export interface ReleasePackage {
  name: string;
  /** Dist-tags as published, e.g. { latest: '0.10.0', next: '0.13.2' }. */
  distTags: Record<string, string>;
  /** Version the feed author recommends for production use. */
  recommended?: string;
  versions: ReleaseVersion[];
}

export interface AdvisoryAffected {
  name: string;
  /** Affected version range expression, e.g. '>=0.13.0 <0.13.2'. */
  range: string;
}

export interface Advisory {
  id: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  affected: AdvisoryAffected[];
  patchedIn?: string;
  url?: string;
  publishedAt?: string;
}

export interface ReleaseFeed {
  schema: 'totemsdk-release-feed/v1';
  generatedAt: string;
  packages: ReleasePackage[];
  advisories?: Advisory[];
}

export interface AvailableUpdate {
  name: string;
  installed: string;
  recommended?: string;
  newest?: string;
  severity: 'info' | 'advisory';
}

export interface ApplicableAdvisory {
  id: string;
  severity: Advisory['severity'];
  title: string;
  package: string;
  installed: string;
  patchedIn?: string;
  url?: string;
}

export interface ReleaseFeedEvaluation {
  updates: AvailableUpdate[];
  advisories: ApplicableAdvisory[];
  /** True when the installed version is not present in the feed at all. */
  unknownInstalled: string[];
}

type Parsed = { major: number; minor: number; patch: number; pre?: string };

export function parseVersion(version: string): Parsed | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(version.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] };
}

/** Semver-ish comparison: -1 | 0 | 1. Pre-release sorts before its release. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && pb.pre) return pa.pre.localeCompare(pb.pre);
  return 0;
}

function satisfiesComparator(version: string, comparator: string): boolean {
  const m = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(comparator.trim());
  if (!m) return false;
  const op = m[1] ?? '=';
  const target = m[2]!.trim();
  const v = parseVersion(version);
  const t = parseVersion(target);
  if (!v || !t) return false;
  const cmp = compareVersions(version, target);
  switch (op) {
    case '>=': return cmp >= 0;
    case '<=': return cmp <= 0;
    case '>': return cmp > 0;
    case '<': return cmp < 0;
    case '^':
      if (t.major > 0) return v.major === t.major && cmp >= 0;
      if (t.minor > 0) return v.major === 0 && v.minor === t.minor && cmp >= 0;
      return v.major === 0 && v.minor === 0 && v.patch === t.patch && cmp >= 0;
    case '~': return v.major === t.major && v.minor === t.minor && cmp >= 0;
    default: return cmp === 0;
  }
}

/** Supports space-separated AND comparators, and `||` alternatives. */
export function satisfiesRange(version: string, range: string): boolean {
  const alternatives = range.split('||').map((part) => part.trim()).filter(Boolean);
  if (alternatives.length === 0) return false;
  return alternatives.some((alt) =>
    alt.split(/\s+/).filter(Boolean).every((cmp) => satisfiesComparator(version, cmp)),
  );
}

export function parseReleaseFeed(input: unknown): ReleaseFeed {
  const feed = input as ReleaseFeed;
  if (!feed || feed.schema !== 'totemsdk-release-feed/v1') {
    throw new Error('unsupported release feed schema');
  }
  if (!Array.isArray(feed.packages)) throw new Error('release feed packages must be an array');
  return feed;
}

/**
 * Compare installed versions against the feed. Read-only: callers decide what to
 * do with the result. Never throws on unknown versions.
 */
export function evaluateReleaseFeed(
  feed: ReleaseFeed,
  installed: Record<string, string>,
): ReleaseFeedEvaluation {
  const updates: AvailableUpdate[] = [];
  const unknownInstalled: string[] = [];
  const advisories: ApplicableAdvisory[] = [];

  for (const [name, current] of Object.entries(installed)) {
    const pkg = feed.packages.find((p) => p.name === name);
    if (!pkg) { unknownInstalled.push(name); continue; }
    if (!pkg.versions.some((v) => v.version === current)) unknownInstalled.push(name);

    const recommended = pkg.recommended ?? pkg.distTags['latest'];
    const newest = pkg.versions.map((v) => v.version).sort(compareVersions).at(-1);
    const behindRecommended = recommended ? compareVersions(current, recommended) < 0 : false;
    const behindNewest = newest ? compareVersions(current, newest) < 0 : false;
    if (behindRecommended || behindNewest) {
      updates.push({
        name,
        installed: current,
        recommended,
        newest,
        severity: 'info',
      });
    }
  }

  for (const advisory of feed.advisories ?? []) {
    for (const affected of advisory.affected) {
      const current = installed[affected.name];
      if (!current) continue;
      if (!satisfiesRange(current, affected.range)) continue;
      advisories.push({
        id: advisory.id,
        severity: advisory.severity,
        title: advisory.title,
        package: affected.name,
        installed: current,
        patchedIn: advisory.patchedIn,
        url: advisory.url,
      });
    }
  }

  return { updates, advisories, unknownInstalled };
}

export interface FetchReleaseFeedOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function fetchReleaseFeed(
  url: string,
  options: FetchReleaseFeedOptions = {},
): Promise<ReleaseFeed> {
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const res = await doFetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`release feed HTTP ${res.status}`);
    return parseReleaseFeed(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

export interface DiscoverInstalledOptions {
  /** Start directory (default: process.cwd()). */
  from?: string;
  /** How many parent directories to search (default 6). */
  maxDepth?: number;
}

/**
 * Best-effort discovery of installed `@totemsdk/*` package versions by walking
 * upward for node_modules. Read-only and runtime-agnostic so any SDK entrypoint
 * can use the same awareness check. Unreadable manifests are skipped.
 */
export async function discoverInstalledTotemPackages(
  options: DiscoverInstalledOptions = {},
): Promise<Record<string, string>> {
  // Lazy so browser bundles never pull node:fs, and the ESM build works.
  // `webpackIgnore` keeps the dynamic specifier opaque to bundlers: the
  // function is Node-only and is never called from browser entrypoints.
  const fs = await import(/* webpackIgnore: true */ 'node:fs');
  const path = await import(/* webpackIgnore: true */ 'node:path');
  const installed: Record<string, string> = {};
  let dir = path.resolve(options.from ?? process.cwd());
  const maxDepth = options.maxDepth ?? 6;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const scopeDir = path.join(dir, 'node_modules', '@totemsdk');
    try {
      for (const entry of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        try {
          const manifest = JSON.parse(
            fs.readFileSync(path.join(scopeDir, entry.name, 'package.json'), 'utf8'),
          ) as { name?: string; version?: string };
          if (manifest.name && manifest.version) installed[manifest.name] = manifest.version;
        } catch {
          // unreadable package manifest — skip
        }
      }
    } catch {
      // no @totemsdk scope at this level
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return installed;
}

export interface UpdateCheckerOptions {
  /** Release-feed URL. Required; without it `start()` is a no-op. */
  url?: string;
  /** Installed versions. Defaults to discoverInstalledTotemPackages(). */
  installed?: Record<string, string>;
  /** Poll interval (default 6h). */
  intervalMs?: number;
  /** Called with a non-empty evaluation. Never called with empty results. */
  onResult?: (result: ReleaseFeedEvaluation) => void;
  onError?: (error: unknown) => void;
  fetchImpl?: typeof fetch;
  /** Inject a deterministic clock for tests. */
  now?: () => number;
  random?: () => number;
}

export interface UpdateChecker {
  check(): Promise<ReleaseFeedEvaluation | null>;
  start(): void;
  stop(): void;
}

/**
 * Awareness-only periodic check. It never installs, blocks, degrades or mutates
 * package state: it evaluates a feed and reports. Safe to embed in any SDK
 * runtime, including long-lived edge adapters.
 */
export function createUpdateChecker(options: UpdateCheckerOptions = {}): UpdateChecker {
  let timer: ReturnType<typeof setInterval> | undefined;
  let initial: ReturnType<typeof setTimeout> | undefined;
  const intervalMs = options.intervalMs && options.intervalMs > 0 ? options.intervalMs : 6 * 60 * 60 * 1000;
  const random = options.random ?? Math.random;

  async function check(): Promise<ReleaseFeedEvaluation | null> {
    if (!options.url) return null;
    try {
      const feed = await fetchReleaseFeed(options.url, { fetchImpl: options.fetchImpl });
      const installed = options.installed ?? (await discoverInstalledTotemPackages());
      const result = evaluateReleaseFeed(feed, installed);
      if (result.updates.length > 0 || result.advisories.length > 0) {
        options.onResult?.(result);
        return result;
      }
      return null;
    } catch (error) {
      options.onError?.(error);
      return null;
    }
  }

  function start(): void {
    if (!options.url || timer) return;
    const jitter = Math.floor(random() * Math.min(intervalMs, 5 * 60 * 1000));
    initial = setTimeout(() => { void check(); }, jitter);
    initial.unref?.();
    timer = setInterval(() => { void check(); }, intervalMs);
    timer.unref?.();
  }

  function stop(): void {
    if (initial) clearTimeout(initial);
    if (timer) clearInterval(timer);
    initial = undefined;
    timer = undefined;
  }

  return { check, start, stop };
}

export interface SignedReleaseAnnouncementLike {
  announcement: {
    kind: string;
    sequence: number;
    createdAt: number;
    expiresAt: number;
    payload?: unknown;
  };
}

/**
 * Project publisher-signed announcements into the evaluator's feed shape.
 *
 * Signed announcements are the source of truth (they carry publisher, sequence
 * and expiry); `release-feed.json` produced by scripts/emit-release-feed.mjs is
 * only a CI artifact / offline snapshot. Highest sequence wins per package or
 * advisory id; expired announcements are ignored.
 */
export function releaseFeedFromAnnouncements(
  signed: SignedReleaseAnnouncementLike[],
  options: { now?: number } = {},
): ReleaseFeed {
  const now = options.now ?? Date.now();
  const live = signed
    .map((s) => s.announcement)
    .filter((a) => a.expiresAt > now)
    .sort((a, b) => a.sequence - b.sequence);

  const packages = new Map<string, ReleasePackage>();
  const advisories = new Map<string, Advisory>();
  let generatedAt = new Date(now).toISOString();

  for (const announcement of live) {
    const payload = announcement.payload as
      | { packages?: ReleasePackage[]; advisories?: Advisory[] }
      | undefined;
    if (!payload) continue;
    generatedAt = new Date(announcement.createdAt).toISOString();
    for (const pkg of payload.packages ?? []) {
      if (pkg?.name) packages.set(pkg.name, pkg);
    }
    for (const advisory of payload.advisories ?? []) {
      if (advisory?.id) advisories.set(advisory.id, advisory);
    }
  }

  return {
    schema: 'totemsdk-release-feed/v1',
    generatedAt,
    packages: [...packages.values()],
    advisories: [...advisories.values()],
  };
}

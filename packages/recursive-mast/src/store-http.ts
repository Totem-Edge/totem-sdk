/**
 * HTTP policy store — fetches policy material from remote HTTP endpoints.
 *
 * Implements RecursiveMastPolicyStore for read operations. Write operations
 * are not supported (HTTP store is read-only). For writable remote storage,
 * use a Hypercore or custom enterprise adapter.
 *
 * Endpoint conventions:
 *   GET /policy/:policyId/manifest/:version
 *   GET /policy/:policyId/manifest/latest
 *   GET /proof/:policyRoot/:scriptHash
 *   GET /bundle/:bundleHash
 */

import type { RecursiveMastPolicyManifest } from './policy-manifest.js';
import type { MastBranchPackage, BranchFilter, MastBranchSummary } from './branch-capsule.js';
import type { RecursiveMastPolicyStore } from './policy-store.js';
import { deserializeBranchPackage, branchSummary } from './branch-capsule.js';

export interface HttpStoreOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export class HttpPolicyStore implements RecursiveMastPolicyStore {
  private baseUrl: string;
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(options: HttpStoreOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async putManifest(_manifest: RecursiveMastPolicyManifest): Promise<string> {
    throw new Error('HTTP store is read-only. Use a writable adapter for putManifest.');
  }

  async getManifest(policyId: string, version?: number): Promise<RecursiveMastPolicyManifest | null> {
    const path = version !== undefined
      ? `/policy/${encodeURIComponent(policyId)}/manifest/${version}`
      : `/policy/${encodeURIComponent(policyId)}/manifest/latest`;
    try {
      const resp = await this.fetchWithTimeout(`${this.baseUrl}${path}`);
      if (resp.status === 404) return null;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return (await resp.json()) as RecursiveMastPolicyManifest;
    } catch {
      return null;
    }
  }

  async putBranch(_branch: MastBranchPackage): Promise<string> {
    throw new Error('HTTP store is read-only. Use a writable adapter for putBranch.');
  }

  async getBranch(policyRoot: string, scriptHash: string): Promise<MastBranchPackage | null> {
    const path = `/proof/${encodeURIComponent(policyRoot)}/${encodeURIComponent(scriptHash)}`;
    try {
      const resp = await this.fetchWithTimeout(`${this.baseUrl}${path}`);
      if (resp.status === 404) return null;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = new Uint8Array(await resp.arrayBuffer());
      return deserializeBranchPackage(data);
    } catch {
      return null;
    }
  }

  async listBranches(policyRoot: string, filter?: BranchFilter): Promise<MastBranchSummary[]> {
    const params = new URLSearchParams();
    if (filter?.action) params.set('action', filter.action);
    if (filter?.role) params.set('role', filter.role);
    if (filter?.minVersion) params.set('minVersion', String(filter.minVersion));
    if (filter?.minEpoch) params.set('minEpoch', String(filter.minEpoch));
    if (filter?.activeOnly) params.set('activeOnly', 'true');

    const qs = params.toString();
    const path = `/proof/${encodeURIComponent(policyRoot)}/branches${qs ? `?${qs}` : ''}`;
    try {
      const resp = await this.fetchWithTimeout(`${this.baseUrl}${path}`);
      if (!resp.ok) return [];
      const data = (await resp.json()) as Array<Record<string, unknown>>;
      return data.map(d => d as unknown as MastBranchSummary);
    } catch {
      return [];
    }
  }

  async putBundle(
    _manifest: RecursiveMastPolicyManifest,
    _branches: MastBranchPackage[],
  ): Promise<string> {
    throw new Error('HTTP store is read-only. Use a writable adapter for putBundle.');
  }

  async getBundle(bundleHash: string): Promise<{
    manifest: RecursiveMastPolicyManifest;
    branches: MastBranchPackage[];
  } | null> {
    const path = `/bundle/${encodeURIComponent(bundleHash)}`;
    try {
      const resp = await this.fetchWithTimeout(`${this.baseUrl}${path}`);
      if (resp.status === 404) return null;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return (await resp.json()) as {
        manifest: RecursiveMastPolicyManifest;
        branches: MastBranchPackage[];
      };
    } catch {
      return null;
    }
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchFn(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

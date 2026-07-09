import { OmniaVtxo, OmniaVtxoPool, OmniaVtxoStore, VtxoId } from './types.js';
import { VtxoStatusError } from './errors.js';

export class MemoryOmniaVtxoStore implements OmniaVtxoStore {
  private readonly pools: Map<string, OmniaVtxoPool> = new Map();
  private readonly vtxos: Map<VtxoId, OmniaVtxo> = new Map();

  async savePool(pool: OmniaVtxoPool): Promise<void> {
    this.pools.set(pool.poolId, pool);
  }

  async getPool(poolId: string): Promise<OmniaVtxoPool | undefined> {
    return this.pools.get(poolId);
  }

  async saveVtxo(vtxo: OmniaVtxo): Promise<void> {
    this.vtxos.set(vtxo.vtxoId, vtxo);
  }

  async getVtxo(vtxoId: VtxoId): Promise<OmniaVtxo | undefined> {
    return this.vtxos.get(vtxoId);
  }

  async listVtxos(poolId?: string): Promise<OmniaVtxo[]> {
    const all = Array.from(this.vtxos.values());
    if (poolId === undefined) return all;
    return all.filter(v => v.poolId === poolId);
  }

  /**
   * Marks a VTXO as spent. Accepts an optional `now` timestamp for deterministic testing.
   * When `now` is omitted the store falls back to `Date.now()` — this is intentional
   * and explicitly documented: the store is a persistence layer, not a pure function,
   * so wall-clock time is an acceptable default for production use. Pass `now` in tests.
   */
  async markVtxoSpent(vtxoId: VtxoId, now?: number): Promise<void> {
    const vtxo = this.vtxos.get(vtxoId);
    if (!vtxo) throw new Error(`VTXO ${vtxoId} not found`);
    if (vtxo.status !== 'active') {
      throw new VtxoStatusError(
        `Cannot mark VTXO ${vtxoId} as spent: status is '${vtxo.status}'`,
        vtxo.status,
      );
    }
    // NOTE: Date.now() fallback is intentional and documented above.
    const ts = now !== undefined ? now : Date.now();
    this.vtxos.set(vtxoId, {
      ...vtxo,
      status: 'spent',
      updatedAt: ts,
      history: [...vtxo.history, { op: 'spent', at: ts }],
    });
  }
}

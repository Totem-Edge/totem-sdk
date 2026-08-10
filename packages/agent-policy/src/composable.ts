import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';
import type { AgentPolicy } from './types.js';

/**
 * ComposablePolicy chains multiple PolicyMiddleware layers into a single
 * evaluation pipeline. Layers are evaluated in registration order with
 * short-circuit semantics: if any layer returns `rejected`, subsequent
 * layers are skipped and the rejection is returned immediately.
 *
 * ComposablePolicy also implements the legacy `AgentPolicy` interface
 * (`canAutoApprove` / `requiresUserApproval`) so it can be used anywhere
 * the old interface is expected (e.g. `@totemsdk/omnia`'s `executeIntent`).
 *
 * ## Middleware contract
 *
 * - `approved`       → continue to next layer
 * - `rejected`       → short-circuit, return rejection
 * - `requires_human` → short-circuit, return requires_human
 *
 * An empty middleware list approves all proposals (pass-through).
 */
export class ComposablePolicy implements AgentPolicy, PolicyMiddleware {
  private readonly layers: PolicyMiddleware[];

  constructor(layers: PolicyMiddleware[]) {
    this.layers = layers;
  }

  async evaluate(proposal: AgentProposal): Promise<PolicyEvalResult> {
    for (const layer of this.layers) {
      const result = await layer.evaluate(proposal);
      if (result.outcome !== 'approved') {
        return result;
      }
    }
    return { outcome: 'approved', reason: 'All policy layers approved' };
  }

  async reserve(proposal: AgentProposal): Promise<PolicyEvalResult> {
    const reserved: PolicyMiddleware[] = [];
    let reservationState: PolicyEvalResult['reservationState'] = undefined;
    try {
      for (const layer of this.layers) {
        const hasReservation = layer.reserve !== undefined;
        const result = hasReservation
          ? await layer.reserve!(proposal)
          : await layer.evaluate(proposal);
        if (result.outcome !== 'approved') {
          await this.releaseLayers(reserved, proposal.id);
          return result;
        }
        if (result.reservationState === 'already_committed') {
          await this.releaseLayers(reserved, proposal.id);
          return { outcome: 'approved', reason: 'All policy layers already committed', reservationState: 'already_committed' };
        }
        if (hasReservation) {
          if (result.reservationState !== 'already_reserved') reserved.push(layer);
          if (result.reservationState === 'already_reserved') reservationState = 'already_reserved';
          else if (!reservationState) reservationState = 'new';
        }
      }
      return { outcome: 'approved', reason: 'All policy layers reserved', reservationState };
    } catch (error) {
      await this.releaseLayers(reserved, proposal.id);
      throw error;
    }
  }

  private async releaseLayers(layers: PolicyMiddleware[], operationId: string): Promise<void> {
    const failures: unknown[] = [];
    for (const layer of [...layers].reverse()) {
      try {
        await layer.release?.(operationId);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) throw new Error(`Policy reservation rollback failed: ${String(failures[0])}`);
  }

  async commit(operationId: string): Promise<void> {
    for (const layer of this.layers) {
      await layer.commit?.(operationId);
    }
  }

  async release(operationId: string): Promise<void> {
    for (const layer of [...this.layers].reverse()) {
      await layer.release?.(operationId);
    }
  }

  async canAutoApprove(proposal: AgentProposal): Promise<boolean> {
    const result = await this.evaluate(proposal);
    return result.outcome === 'approved';
  }

  async requiresUserApproval(proposal: AgentProposal): Promise<boolean> {
    const result = await this.evaluate(proposal);
    return result.outcome === 'requires_human';
  }

  async reset(): Promise<void> {
    for (const layer of this.layers) {
      if (layer.reset) {
        await layer.reset();
      }
    }
  }
}

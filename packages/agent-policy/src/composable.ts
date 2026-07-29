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

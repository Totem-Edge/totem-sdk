/**
 * Optional verified recipe accelerators. They are fixtures for the shared
 * planner/scaffolder, not special-cased branches and not the taxonomy of
 * supported applications.
 */

import type { PlanCompositionInput, CompositionPlan } from './composition.js'
import { planComposition } from './composition.js'
import type { SdkIndex } from './types.js'

export interface RecipeDefinition {
  id: string
  title: string
  boundary: string
  input: Omit<PlanCompositionInput, 'brief'>
}

export const RECIPES: RecipeDefinition[] = [
  {
    id: 'digital-product-passport',
    title: 'Digital Product Passport',
    boundary: 'Passport assembles attested event evidence; generated summaries are not certified digital twins.',
    input: {
      runtime: 'node-esm',
      requiredPackages: ['@totemsdk/edge-mqtt', '@totemsdk/core', '@totemsdk/proof', '@totemsdk/proofgraph'],
      suggestedPackages: ['@totemsdk/manifest', '@totemsdk/identity', '@totemsdk/authority', '@totemsdk/intelligence', '@totemsdk/qvac', '@totemsdk/storage'],
      requiredCapabilities: ['attested event evidence', 'manifest identity', 'proof graph', 'local AI summary'],
    },
  },
  {
    id: 'machinepay-edge',
    title: 'MachinePay Edge Gateway',
    boundary: 'The gateway executes only within a signed policy envelope; payment receipts do not certify the physical outcome.',
    input: {
      runtime: 'node-esm',
      requiredPackages: ['@totemsdk/edge', '@totemsdk/edge-mqtt', '@totemsdk/omnia', '@totemsdk/agent-policy'],
      suggestedPackages: ['@totemsdk/manifest', '@totemsdk/proofgraph', '@totemsdk/root-identity'],
      requiredCapabilities: ['edge device runtime', 'mqtt transport', 'payment channel', 'agent policy'],
    },
  },
]

export function planRecipe(recipe: RecipeDefinition, index: SdkIndex): CompositionPlan {
  return planComposition({ ...recipe.input, brief: `${recipe.title}. ${recipe.boundary}` }, index)
}

import type { ActionDefinition, ActionExecutor } from './types.js'
import { ActionDefinitionError } from './errors.js'

/**
 * @deprecated Superseded by the `@totemsdk/edge` `EdgeActionRegistry`. Will be
 * removed in a future minor.
 */
export class ActionRegistry {
  private definitions: Map<string, ActionDefinition> = new Map()
  private executors: Map<string, ActionExecutor> = new Map()

  registerDefinition(definition: ActionDefinition): void {
    if (this.definitions.has(definition.kind)) {
      throw new ActionDefinitionError(`definition '${definition.kind}' is already registered`)
    }
    this.definitions.set(definition.kind, definition)
  }

  registerExecutor(executor: ActionExecutor): void {
    if (this.executors.has(executor.kind)) {
      throw new ActionDefinitionError(`executor '${executor.kind}' is already registered`)
    }
    this.executors.set(executor.kind, executor)
  }

  getDefinition(kind: string): ActionDefinition | undefined {
    return this.definitions.get(kind)
  }

  getExecutor(kind: string): ActionExecutor | undefined {
    return this.executors.get(kind)
  }

  getDefinitionOrThrow(kind: string): ActionDefinition {
    const def = this.definitions.get(kind)
    if (!def) throw new ActionDefinitionError(`no definition registered for '${kind}'`)
    return def
  }

  getExecutorOrThrow(kind: string): ActionExecutor {
    const exec = this.executors.get(kind)
    if (!exec) throw new ActionDefinitionError(`no executor registered for '${kind}'`)
    return exec
  }

  hasDefinition(kind: string): boolean {
    return this.definitions.has(kind)
  }

  hasExecutor(kind: string): boolean {
    return this.executors.has(kind)
  }

  listKinds(): string[] {
    return Array.from(this.definitions.keys())
  }
}

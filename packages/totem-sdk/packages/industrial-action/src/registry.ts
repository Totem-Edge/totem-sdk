import type { IndustrialActionDefinition, ActionExecutor } from './types.js'
import { ActionDefinitionError } from './errors.js'

export class ActionRegistry {
  private definitions: Map<string, IndustrialActionDefinition> = new Map()
  private executors: Map<string, ActionExecutor> = new Map()

  registerDefinition(definition: IndustrialActionDefinition): void {
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

  getDefinition(kind: string): IndustrialActionDefinition | undefined {
    return this.definitions.get(kind)
  }

  getExecutor(kind: string): ActionExecutor | undefined {
    return this.executors.get(kind)
  }

  getDefinitionOrThrow(kind: string): IndustrialActionDefinition {
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

export class IndustrialActionError extends Error {
  public readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'IndustrialActionError'
    this.code = code
  }
}

export class ActionDefinitionError extends IndustrialActionError {
  constructor(message: string) {
    super('ACTION_DEFINITION_ERROR', message)
    this.name = 'ActionDefinitionError'
  }
}

export class ActionValidationError extends IndustrialActionError {
  public readonly details: Record<string, unknown>
  constructor(message: string, details?: Record<string, unknown>) {
    super('ACTION_VALIDATION_ERROR', message)
    this.name = 'ActionValidationError'
    this.details = details ?? {}
  }
}

export class ActionExecutionError extends IndustrialActionError {
  constructor(message: string) {
    super('ACTION_EXECUTION_ERROR', message)
    this.name = 'ActionExecutionError'
  }
}

export class ActionConditionError extends IndustrialActionError {
  constructor(message: string) {
    super('ACTION_CONDITION_ERROR', message)
    this.name = 'ActionConditionError'
  }
}

export class ActionGovernanceError extends IndustrialActionError {
  constructor(message: string) {
    super('ACTION_GOVERNANCE_ERROR', message)
    this.name = 'ActionGovernanceError'
  }
}

export class ActionCommitmentError extends IndustrialActionError {
  constructor(message: string) {
    super('ACTION_COMMITMENT_ERROR', message)
    this.name = 'ActionCommitmentError'
  }
}

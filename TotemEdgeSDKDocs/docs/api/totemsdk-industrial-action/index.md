**@totemsdk/industrial-action**

***

# @totemsdk/industrial-action

## Classes

- [ActionCommitmentError](classes/ActionCommitmentError.md)
- [ActionConditionError](classes/ActionConditionError.md)
- [ActionDefinitionError](classes/ActionDefinitionError.md)
- [ActionExecutionError](classes/ActionExecutionError.md)
- [ActionGovernanceError](classes/ActionGovernanceError.md)
- [ActionRegistry](classes/ActionRegistry.md)
- [ActionValidationError](classes/ActionValidationError.md)
- [IndustrialActionError](classes/IndustrialActionError.md)

## Interfaces

- [ActionError](interfaces/ActionError.md)
- [ActionExecution](interfaces/ActionExecution.md)
- [ActionExecutor](interfaces/ActionExecutor.md)
- [ActionHandler](interfaces/ActionHandler.md)
- [ActionProposal](interfaces/ActionProposal.md)
- [ActionReceipt](interfaces/ActionReceipt.md)
- [ActionSchema](interfaces/ActionSchema.md)
- [ActionStorage](interfaces/ActionStorage.md)
- [Condition](interfaces/Condition.md)
- [ConditionResult](interfaces/ConditionResult.md)
- [ContextField](interfaces/ContextField.md)
- [ContextSchema](interfaces/ContextSchema.md)
- [CreateProposalParams](interfaces/CreateProposalParams.md)
- [ExecuteActionResult](interfaces/ExecuteActionResult.md)
- [GovernanceBridge](interfaces/GovernanceBridge.md)
- [IndustrialActionDefinition](interfaces/IndustrialActionDefinition.md)
- [ParameterSchema](interfaces/ParameterSchema.md)

## Type Aliases

- [ActionStatus](type-aliases/ActionStatus.md)
- [ExecutionStatus](type-aliases/ExecutionStatus.md)
- [ParameterType](type-aliases/ParameterType.md)

## Functions

- [assertValidContext](functions/assertValidContext.md)
- [assertValidParameters](functions/assertValidParameters.md)
- [assertValidProposal](functions/assertValidProposal.md)
- [canonicalJson](functions/canonicalJson.md)
- [checkGovernanceConstraints](functions/checkGovernanceConstraints.md)
- [computeActionExecutionId](functions/computeActionExecutionId.md)
- [computeActionProposalId](functions/computeActionProposalId.md)
- [computeCommitmentHash](functions/computeCommitmentHash.md)
- [computeReceiptId](functions/computeReceiptId.md)
- [createActionDefinition](functions/createActionDefinition.md)
- [createCommitment](functions/createCommitment.md)
- [createCondition](functions/createCondition.md)
- [createGovernanceBridge](functions/createGovernanceBridge.md)
- [createProposal](functions/createProposal.md)
- [createReceipt](functions/createReceipt.md)
- [evaluateConditions](functions/evaluateConditions.md)
- [executeAction](functions/executeAction.md)
- [hashCanonical](functions/hashCanonical.md)
- [isProposalExecutable](functions/isProposalExecutable.md)
- [isProposalExpired](functions/isProposalExpired.md)
- [serializeCommitmentPayload](functions/serializeCommitmentPayload.md)
- [toHex](functions/toHex.md)
- [validateContext](functions/validateContext.md)
- [validateParameters](functions/validateParameters.md)
- [verifyCommitment](functions/verifyCommitment.md)
- [verifyCommitmentBinding](functions/verifyCommitmentBinding.md)
- [verifyReceiptIntegrity](functions/verifyReceiptIntegrity.md)

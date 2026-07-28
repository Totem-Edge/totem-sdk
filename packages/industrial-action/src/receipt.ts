import type { ActionReceipt } from './types.js'
import { computeReceiptId } from './ids.js'

export function createReceipt(params: {
  actionId: string
  proposalId: string
  kind: string
  status: ActionReceipt['status']
  commitmentHash: string
  parameters: Record<string, unknown>
  result?: unknown
  error?: { code: string; message: string; details?: Record<string, unknown> }
  issuedAt?: number
}): ActionReceipt {
  const receiptId = computeReceiptId(params.actionId, params.proposalId)
  return {
    receiptId,
    actionId: params.actionId,
    proposalId: params.proposalId,
    kind: params.kind,
    status: params.status,
    commitmentHash: params.commitmentHash,
    parameters: params.parameters,
    result: params.result,
    error: params.error,
    issuedAt: params.issuedAt ?? Date.now(),
  }
}

export function verifyReceiptIntegrity(receipt: ActionReceipt): boolean {
  const expectedId = computeReceiptId(receipt.actionId, receipt.proposalId)
  return receipt.receiptId === expectedId
}

import type { UsageReservation, MandateReceipt, ProposalActionType } from './types.js'

const DEFAULT_RESERVATION_TTL_MS = 60000

export class UsageStore {
  private reservations: Map<string, UsageReservation> = new Map()
  private receipts: Map<string, MandateReceipt> = new Map()

  reserveMandateUse(
    mandateProofId: string,
    intentId: string,
    ttlMs?: number,
  ): UsageReservation {
    const now = Date.now()
    this.cleanExpired()

    const existing = Array.from(this.reservations.values()).find(
      (r) =>
        r.mandateProofId === mandateProofId &&
        r.intentId === intentId &&
        r.status === 'reserved',
    )
    if (existing) return existing

    const id = `res:${mandateProofId.slice(0, 8)}:${intentId.slice(0, 8)}:${now}`
    const reservation: UsageReservation = {
      id,
      mandateProofId,
      intentId,
      reservedAt: now,
      expiresAt: now + (ttlMs ?? DEFAULT_RESERVATION_TTL_MS),
      status: 'reserved',
    }

    this.reservations.set(id, reservation)
    return reservation
  }

  commitMandateUse(
    reservationId: string,
    receiptParams: {
      proposalId: string
      actionIndex: number
      actionType: ProposalActionType
      proofId?: string
    },
  ): MandateReceipt | string {
    const res = this.reservations.get(reservationId)
    if (!res) return 'reservation not found'
    if (res.status !== 'reserved') return `reservation is in status '${res.status}'`
    if (Date.now() > res.expiresAt) {
      res.status = 'aborted'
      return 'reservation has expired'
    }

    const id = `receipt:${res.mandateProofId.slice(0, 8)}:${receiptParams.proposalId.slice(0, 8)}:${Date.now()}`
    const receipt: MandateReceipt = {
      id,
      mandateProofId: res.mandateProofId,
      intentId: res.intentId,
      proposalId: receiptParams.proposalId,
      actionIndex: receiptParams.actionIndex,
      actionType: receiptParams.actionType,
      committedAt: Date.now(),
      proofId: receiptParams.proofId,
    }

    res.status = 'committed'
    this.reservations.set(reservationId, res)
    this.receipts.set(id, receipt)
    return receipt
  }

  abortMandateUse(
    reservationId: string,
    _reason?: string,
  ): boolean {
    const res = this.reservations.get(reservationId)
    if (!res) return false
    if (res.status !== 'reserved') return false
    res.status = 'aborted'
    this.reservations.set(reservationId, res)
    return true
  }

  getReservation(reservationId: string): UsageReservation | undefined {
    return this.reservations.get(reservationId)
  }

  getReceipt(receiptId: string): MandateReceipt | undefined {
    return this.receipts.get(receiptId)
  }

  getReceiptsByMandate(mandateProofId: string): MandateReceipt[] {
    return Array.from(this.receipts.values()).filter(
      (r) => r.mandateProofId === mandateProofId,
    )
  }

  getReservationsByMandate(mandateProofId: string): UsageReservation[] {
    return Array.from(this.reservations.values()).filter(
      (r) => r.mandateProofId === mandateProofId,
    )
  }

  private cleanExpired(): void {
    const now = Date.now()
    for (const [id, res] of this.reservations) {
      if (res.status === 'reserved' && now > res.expiresAt) {
        res.status = 'aborted'
        this.reservations.set(id, res)
      }
    }
  }
}

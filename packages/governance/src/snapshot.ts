import type { MembershipEntry, MembershipSnapshot } from './types.js'
import { computeSnapshotHash } from './ids.js'

export function freezeMembershipSnapshot(
  daoId: string,
  entries: MembershipEntry[],
  frozenAt?: number,
): MembershipSnapshot {
  const at = frozenAt ?? Date.now()
  const map = new Map<string, MembershipEntry>()
  for (const entry of entries) {
    if (!entry.memberId) continue
    const existing = map.get(entry.memberId)
    if (!existing || entry.addedAt >= existing.addedAt) {
      map.set(entry.memberId, { ...entry })
    }
  }
  const snapshotEntries = Array.from(map.values())
  const hash = computeSnapshotHash(
    daoId,
    at,
    snapshotEntries.map((e) => ({ memberId: e.memberId, weight: e.weight })),
  )
  return { daoId, frozenAt: at, entries: map, hash }
}

export function verifyMembershipSnapshot(snapshot: MembershipSnapshot): boolean {
  const snapshotEntryHashes = Array.from(snapshot.entries.values()).map((e) => ({
    memberId: e.memberId,
    weight: e.weight,
  }))
  const expectedHash = computeSnapshotHash(snapshot.daoId, snapshot.frozenAt, snapshotEntryHashes)
  return expectedHash === snapshot.hash
}

export function getMemberWeight(
  snapshot: MembershipSnapshot,
  memberId: string,
): number {
  const entry = snapshot.entries.get(memberId)
  if (!entry) return 0
  if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) return 0
  return entry.weight
}

export function getTotalWeight(snapshot: MembershipSnapshot): number {
  let total = 0
  for (const entry of snapshot.entries.values()) {
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) continue
    total += entry.weight
  }
  return total
}

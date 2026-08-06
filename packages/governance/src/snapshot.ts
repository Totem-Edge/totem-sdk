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
    // The freezer excludes anyone added after the freeze point — they have no
    // eligibility for this snapshot.
    if (entry.addedAt > at) continue
    const existing = map.get(entry.memberId)
    if (!existing || entry.addedAt >= existing.addedAt) {
      map.set(entry.memberId, { ...entry })
    }
  }
  const snapshotEntries = Array.from(map.values())
  const hash = computeSnapshotHash(daoId, at, snapshotEntries)
  return { daoId, frozenAt: at, entries: map, hash }
}

export function verifyMembershipSnapshot(snapshot: MembershipSnapshot): boolean {
  const snapshotEntries = Array.from(snapshot.entries.values())
  const expectedHash = computeSnapshotHash(snapshot.daoId, snapshot.frozenAt, snapshotEntries)
  return expectedHash === snapshot.hash
}

export function getMemberWeight(
  snapshot: MembershipSnapshot,
  memberId: string,
  at = Date.now(),
): number {
  const entry = snapshot.entries.get(memberId)
  if (!entry) return 0
  if (entry.expiresAt !== undefined && at > entry.expiresAt) return 0
  return entry.weight
}

export function getTotalWeight(snapshot: MembershipSnapshot, at = Date.now()): number {
  let total = 0
  for (const entry of snapshot.entries.values()) {
    if (entry.expiresAt !== undefined && at > entry.expiresAt) continue
    total += entry.weight
  }
  return total
}

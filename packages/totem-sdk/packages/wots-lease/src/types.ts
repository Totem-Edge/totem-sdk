/**
 * @totemsdk/wots-lease — canonical v3 watermark types and WotsLeaseProvider interface
 */

export type UnavailableReason = 'committed' | 'burned' | 'reserved-expired';

export interface SigningIndices {
  addressIndex: number;
  l1: number;
  l2: number;
}

export type LeaseStatus = 'pending' | 'active' | 'expired' | 'finalized' | 'cancelled';

export interface TreeWatermark {
  treeId: string;
  deviceId?: string;
  branchId?: string;
  addressCursor: number;
  l1Cursor: number;
  l2Cursor: number;
  unavailable: Record<number, UnavailableReason>;
  lastSyncTimestamp?: number;
}

export interface WotsWatermarkState {
  version: 3;
  trees: Record<string, TreeWatermark>;
}

export interface LeaseCertificate {
  reservationId: string;
  treeId: string;
  branchId?: string;
  deviceId?: string;
  indices: SigningIndices;
  purpose?: string;
  payloadHash?: string;
  issuedBy: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

export interface LeaseReservation {
  reservationId: string;
  indices: SigningIndices;
  expiresAt: number;
  certificate?: LeaseCertificate;
  leaseToken?: string;
}

export interface ReserveParams {
  treeId: string;
  branchId?: string;
  purpose?: string;
  deviceId?: string;
  ttlMs?: number;
  payloadHash?: string;
  valueHint?: string;
}

export interface LocalWatermark {
  treeId: string;
  addressCursor: number;
  l1Cursor: number;
  l2Cursor: number;
  unavailableCount: number;
  capacity: number;
  lastSyncTimestamp?: number;
}

export interface ConflictRecord {
  treeId: string;
  localIndex: number;
  remoteIndex: number;
  timestamp: number;
}

export interface SyncResult {
  synced: boolean;
  conflicts: ConflictRecord[];
  advancedTo?: SigningIndices;
}

export interface WotsLeaseProvider {
  reserveKeyUse(params: ReserveParams): Promise<LeaseReservation>;
  commitKeyUse(reservationId: string, txId: string): Promise<void>;
  burnReservation(reservationId: string, reason: string): Promise<void>;
  getLocalWatermark(treeId: string): Promise<LocalWatermark>;
  publishWatermark(treeId: string): Promise<void>;
  syncLeaseJournal(): Promise<SyncResult>;
  verifyLeaseCertificate(cert?: LeaseCertificate): Promise<boolean>;
}

export interface JournalEntry {
  treeId: string;
  branchId: string;
  wotsIndex: number;
  indices: SigningIndices;
  status: 'reserved' | 'committed' | 'burned' | 'reserved-expired';
  payloadHash?: string;
  txId?: string;
  timestamp: number;
  deviceId: string;
}

export interface DeviceKeyRange {
  deviceId: string;
  startAddressIndex: number;
  endAddressIndex: number;
  addressCount: number;
}

export interface PersonalLeaseNodeConfig {
  nodeUrl: string;
  nodePubkey: string;
  authToken?: string;
}

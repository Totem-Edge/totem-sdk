/**
 * @module @totemsdk/core/adapters/types
 * Shared type definitions for SDK modules
 */

export interface WotsIndices {
  addressIndex: number;
  l1: number;
  l2: number;
}

export type LeaseStatus = 'pending' | 'active' | 'expired' | 'finalized' | 'cancelled';

export interface StoredLease {
  leaseId: string;
  leaseToken: string;
  indices: WotsIndices;
  expiresAt: number;
  status: LeaseStatus;
  createdAt: number;
  txId?: string;
  leaseTTL: number;
}

export interface WatermarkState {
  next_addressIndex: number;
  next_l1: number;
  next_l2: number;
  usedIndices: Array<[number, number, number]>;
  lastSyncTimestamp?: number;
  serverWatermark?: WotsIndices;
}

export interface SyncResult {
  updated: boolean;
  drift: number;
  hasConflict: boolean;
}

export interface LeaseExpiryEvent {
  leaseId: string;
  expiresAt: number;
  remainingMs: number;
}

export type LeaseExpiryCallback = (event: LeaseExpiryEvent) => void;

export interface TransactionPrepareParams {
  txId: string;
  rootPublicKey: string;
  to: string;
  amount: string;
  tokenId?: string;
  burn?: string | null;
  digestL2?: string | null;
  digestL3?: string | null;
  ttlMs?: number;
}

export interface PreparedTransaction {
  leaseToken: string;
  lease: WotsIndices;
  txId: string;
  digestTx?: string | null;
}

export interface SignedTransaction {
  txId: string;
  signedHex: string;
  leaseToken: string;
}

export interface FinalizedTransaction {
  txId: string;
  status: 'success' | 'failed';
  blockHeight?: number;
  confirmations?: number;
  error?: string;
}

export type TransactionStatus = 
  | 'preparing'
  | 'signing'
  | 'submitting'
  | 'pending'
  | 'confirmed'
  | 'failed';

export interface TransactionState {
  txId: string;
  status: TransactionStatus;
  lease?: StoredLease;
  signedHex?: string;
  blockHeight?: number;
  confirmations?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BalanceSnapshot {
  address: string;
  confirmed: string;
  unconfirmed: string;
  total: string;
  tokenId: string;
  timestamp: number;
}

export interface BalanceUpdate {
  type: 'snapshot' | 'delta';
  address: string;
  tokenId: string;
  confirmed?: string;
  unconfirmed?: string;
  total?: string;
  delta?: string;
  timestamp: number;
}

export type ConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  lastConnectedAt?: number;
  lastDisconnectedAt?: number;
  reconnectAttempts: number;
  error?: string;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: number;
  windowMs: number;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export class SdkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SdkError';
  }
}

export class StorageError extends SdkError {
  constructor(message: string, cause?: Error) {
    super(message, 'STORAGE_ERROR', cause);
    this.name = 'StorageError';
  }
}

export class NetworkError extends SdkError {
  constructor(message: string, cause?: Error) {
    super(message, 'NETWORK_ERROR', cause);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends SdkError {
  constructor(message: string, cause?: Error) {
    super(message, 'AUTH_ERROR', cause);
    this.name = 'AuthenticationError';
  }
}

export class LeaseError extends SdkError {
  constructor(message: string, cause?: Error) {
    super(message, 'LEASE_ERROR', cause);
    this.name = 'LeaseError';
  }
}

export class TransactionError extends SdkError {
  constructor(message: string, cause?: Error) {
    super(message, 'TRANSACTION_ERROR', cause);
    this.name = 'TransactionError';
  }
}

export class QuotaExceededError extends SdkError {
  constructor(
    message: string,
    public readonly quotaInfo: QuotaInfo,
    cause?: Error
  ) {
    super(message, 'QUOTA_EXCEEDED', cause);
    this.name = 'QuotaExceededError';
  }
}

export type EventUnsubscribe = () => void;

export interface EventEmitter<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): EventUnsubscribe;
  off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): void;
  emit<K extends keyof Events>(event: K, data: Events[K]): void;
}

export function createEventEmitter<Events extends Record<string, unknown>>(): EventEmitter<Events> {
  const listeners = new Map<keyof Events, Set<(data: unknown) => void>>();
  
  return {
    on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): EventUnsubscribe {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener as (data: unknown) => void);
      return () => listeners.get(event)?.delete(listener as (data: unknown) => void);
    },
    
    off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): void {
      listeners.get(event)?.delete(listener as (data: unknown) => void);
    },
    
    emit<K extends keyof Events>(event: K, data: Events[K]): void {
      listeners.get(event)?.forEach(listener => listener(data));
    }
  };
}

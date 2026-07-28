/**
 * ConnectedSitesStore — persistent dApp connection and transaction permissions in IndexedDB.
 *
 * Schema
 * ------
 * DB: totem-pwa-wallet  version: 2
 *   store "connected-sites": { origin (key), address, permissions, grantedAt, expiresAt }
 *   store "tx-permissions":   { origin (key), allowedIntents, tokenLimits, dailyUsage, grantedAt, expiresAt }
 */
import { openDB, type IDBPDatabase } from 'idb';

export type DAppTransactionIntent =
  | 'send' | 'token_send' | 'swap' | 'liquidity_add' | 'liquidity_remove'
  | 'contract_call' | 'multisig' | 'timelock' | 'htlc' | 'custom'
  | 'utxo_read' | 'complex_send' | 'sign_data' | 'broadcast_tx';

export interface TokenSpendingLimit {
  tokenId: string;
  tokenSymbol: string;
  maxAmountPerTx: string;
  maxDailyAmount: string;
}

export interface DailyUsage {
  date: string;
  tokenId: string;
  amount: string;
}

export interface ConnectedSite {
  origin: string;
  address: string;
  addressIndex: number;
  grantedAt: number;
  expiresAt: number;
}

export interface TxPermission {
  origin: string;
  allowedIntents: DAppTransactionIntent[];
  tokenLimits: TokenSpendingLimit[];
  dailyUsage: DailyUsage[];
  grantedAt: number;
  expiresAt: number;
}

const DB_NAME = 'totem-pwa-wallet';
const DB_VERSION = 2;

let _db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('connected-sites')) {
        db.createObjectStore('connected-sites', { keyPath: 'origin' });
      }
      if (!db.objectStoreNames.contains('tx-permissions')) {
        db.createObjectStore('tx-permissions', { keyPath: 'origin' });
      }
    },
  });
  return _db;
}

export const ConnectedSitesStore = {
  // ── Connection management ──────────────────────────────────────────────

  async addConnection(site: ConnectedSite): Promise<void> {
    const db = await getDb();
    await db.put('connected-sites', site);
  },

  async removeConnection(origin: string): Promise<void> {
    const db = await getDb();
    await db.delete('connected-sites', origin);
  },

  async getConnection(origin: string): Promise<ConnectedSite | undefined> {
    const db = await getDb();
    return db.get('connected-sites', origin);
  },

  async getAllConnections(): Promise<ConnectedSite[]> {
    const db = await getDb();
    return db.getAll('connected-sites');
  },

  async clearAllConnections(): Promise<void> {
    const db = await getDb();
    await db.clear('connected-sites');
  },

  // ── Transaction permissions ─────────────────────────────────────────────

  async grantPermission(perm: TxPermission): Promise<void> {
    const db = await getDb();
    await db.put('tx-permissions', perm);
  },

  async revokePermission(origin: string): Promise<void> {
    const db = await getDb();
    await db.delete('tx-permissions', origin);
  },

  async getPermission(origin: string): Promise<TxPermission | undefined> {
    const db = await getDb();
    return db.get('tx-permissions', origin);
  },

  async getAllPermissions(): Promise<TxPermission[]> {
    const db = await getDb();
    return db.getAll('tx-permissions');
  },

  async recordDailyUsage(origin: string, tokenId: string, amount: string): Promise<void> {
    const db = await getDb();
    const perm = await db.get('tx-permissions', origin);
    if (!perm) return;
    const today = new Date().toISOString().slice(0, 10);
    perm.dailyUsage.push({ date: today, tokenId, amount });
    await db.put('tx-permissions', perm);
  },

  async canExecuteTransaction(
    origin: string,
    intent: DAppTransactionIntent,
    tokenId: string,
    amount: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const perm = await this.getPermission(origin);
    if (!perm) return { allowed: false, reason: 'No permissions granted' };

    if (Date.now() > perm.expiresAt) {
      return { allowed: false, reason: 'Permission expired' };
    }

    if (!perm.allowedIntents.includes(intent)) {
      return { allowed: false, reason: `Intent '${intent}' not permitted` };
    }

    const limit = perm.tokenLimits.find(l => l.tokenId === tokenId);
    if (limit) {
      if (BigInt(amount) > BigInt(limit.maxAmountPerTx)) {
        return { allowed: false, reason: `Amount exceeds per-tx limit of ${limit.maxAmountPerTx}` };
      }
      const today = new Date().toISOString().slice(0, 10);
      const todayTotal = perm.dailyUsage
        .filter(u => u.date === today && u.tokenId === tokenId)
        .reduce((sum, u) => (BigInt(sum) + BigInt(u.amount)).toString(), '0');
      if (BigInt(todayTotal) + BigInt(amount) > BigInt(limit.maxDailyAmount)) {
        return { allowed: false, reason: `Amount exceeds daily limit of ${limit.maxDailyAmount}` };
      }
    }

    return { allowed: true };
  },
};

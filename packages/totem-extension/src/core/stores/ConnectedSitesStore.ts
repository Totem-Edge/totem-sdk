const DECIMAL_PRECISION = 8;

function decimalToBigInt(value: string): bigint {
  const str = (value || '0').trim();
  const negative = str.startsWith('-');
  const abs = negative ? str.slice(1) : str;
  const parts = abs.split('.');
  const whole = parts[0] || '0';
  const frac = (parts[1] || '').slice(0, DECIMAL_PRECISION).padEnd(DECIMAL_PRECISION, '0');
  const result = BigInt(whole + frac);
  return negative ? -result : result;
}

function bigIntToDecimal(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const str = abs.toString().padStart(DECIMAL_PRECISION + 1, '0');
  const whole = str.slice(0, str.length - DECIMAL_PRECISION);
  let frac = str.slice(str.length - DECIMAL_PRECISION);
  frac = frac.replace(/0+$/, '');
  const result = frac.length > 0 ? `${whole}.${frac}` : whole;
  return negative ? `-${result}` : result;
}

export interface ConnectedSite {
  origin: string;
  addressIndex: number;
  minimaAddress: string;
  connectedAt: number;
  lastUsedAt: number;
  permissions: SitePermissions;
  transactionPermissions?: SiteTransactionPermissions;
}

export interface SitePermissions {
  canConnect: boolean;
  canVerify: boolean;
  canRequestSignature: boolean;
  canSendTransaction: boolean;
}

export type DAppTransactionIntent =
  | 'send'
  | 'token_send'
  | 'swap'
  | 'liquidity_add'
  | 'liquidity_remove'
  | 'contract_call'
  | 'multisig'
  | 'timelock'
  | 'htlc'
  | 'custom'
  | 'utxo_read'
  | 'complex_send'
  | 'sign_data'
  | 'broadcast_tx';

export interface TokenSpendingLimit {
  tokenId: string;
  tokenSymbol: string;
  maxAmountPerTx: string;
  maxDailyAmount: string;
  dailyUsed: string;
  lastResetDate: string;
}

export interface SiteTransactionPermissions {
  grantedAt: number;
  expiresAt: number;
  allowedIntents: DAppTransactionIntent[];
  tokenLimits: TokenSpendingLimit[];
  totalTransactions: number;
  lastTransactionAt?: number;
}

export interface VerificationRecord {
  id: string;
  origin: string;
  addressIndex: number;
  challenge: string;
  nonce: string;
  signedAt: number;
  expiresAt: number;
  treeIndices: { l1: number; l2: number; l3: number };
}

const SITES_STORAGE_KEY = 'totem_connected_sites';
const VERIFICATIONS_STORAGE_KEY = 'totem_verifications';

export class ConnectedSitesStore {
  private sites: Map<string, ConnectedSite> = new Map();
  private verifications: Map<string, VerificationRecord> = new Map();

  async load(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([SITES_STORAGE_KEY, VERIFICATIONS_STORAGE_KEY]);
      
      if (result[SITES_STORAGE_KEY]) {
        const sitesArray: ConnectedSite[] = result[SITES_STORAGE_KEY];
        this.sites = new Map(sitesArray.map(site => [site.origin, site]));
        console.log(`[ConnectedSites] Loaded ${this.sites.size} connected sites`);
      }
      
      if (result[VERIFICATIONS_STORAGE_KEY]) {
        const verificationsArray: VerificationRecord[] = result[VERIFICATIONS_STORAGE_KEY];
        this.verifications = new Map(verificationsArray.map(v => [v.id, v]));
        console.log(`[ConnectedSites] Loaded ${this.verifications.size} verification records`);
      }
    } catch (error) {
      console.error('[ConnectedSites] Failed to load:', error);
    }
  }

  private async persistSites(): Promise<void> {
    try {
      const sitesArray = Array.from(this.sites.values());
      await chrome.storage.local.set({
        [SITES_STORAGE_KEY]: sitesArray
      });
    } catch (error) {
      console.error('[ConnectedSites] Failed to persist sites:', error);
      throw error;
    }
  }

  private async persistVerifications(): Promise<void> {
    try {
      const verificationsArray = Array.from(this.verifications.values());
      await chrome.storage.local.set({
        [VERIFICATIONS_STORAGE_KEY]: verificationsArray
      });
    } catch (error) {
      console.error('[ConnectedSites] Failed to persist verifications:', error);
      throw error;
    }
  }

  async connectSite(
    origin: string, 
    addressIndex: number, 
    minimaAddress: string,
    permissions: Partial<SitePermissions> = {}
  ): Promise<ConnectedSite> {
    const now = Date.now();
    const site: ConnectedSite = {
      origin: this.normalizeOrigin(origin),
      addressIndex,
      minimaAddress,
      connectedAt: now,
      lastUsedAt: now,
      permissions: {
        canConnect: true,
        canVerify: true,
        canRequestSignature: false,
        canSendTransaction: false,
        ...permissions
      }
    };

    console.log(`[ConnectedSites] 🔗 Connecting site: ${site.origin}`);
    console.log(`[ConnectedSites]    Address index: ${addressIndex}`);
    console.log(`[ConnectedSites]    Minima address: ${minimaAddress.slice(0, 20)}...`);

    this.sites.set(site.origin, site);
    await this.persistSites();
    return site;
  }

  getSite(origin: string): ConnectedSite | undefined {
    const normalized = this.normalizeOrigin(origin);
    return this.sites.get(normalized);
  }

  isConnected(origin: string): boolean {
    return this.sites.has(this.normalizeOrigin(origin));
  }

  getConnectedAddress(origin: string): { addressIndex: number; minimaAddress: string } | undefined {
    const site = this.getSite(origin);
    if (site) {
      return {
        addressIndex: site.addressIndex,
        minimaAddress: site.minimaAddress
      };
    }
    return undefined;
  }

  getAllSites(): ConnectedSite[] {
    return Array.from(this.sites.values());
  }

  async updateLastUsed(origin: string): Promise<void> {
    const site = this.getSite(origin);
    if (site) {
      site.lastUsedAt = Date.now();
      await this.persistSites();
    }
  }

  async updatePermissions(origin: string, permissions: Partial<SitePermissions>): Promise<void> {
    const site = this.getSite(origin);
    if (site) {
      site.permissions = { ...site.permissions, ...permissions };
      await this.persistSites();
      console.log(`[ConnectedSites] Updated permissions for ${origin}:`, site.permissions);
    }
  }

  async disconnectSite(origin: string): Promise<boolean> {
    const normalized = this.normalizeOrigin(origin);
    const existed = this.sites.delete(normalized);
    if (existed) {
      console.log(`[ConnectedSites] 🔌 Disconnected site: ${normalized}`);
      await this.persistSites();
    }
    return existed;
  }

  async disconnectAll(): Promise<void> {
    const count = this.sites.size;
    this.sites.clear();
    await chrome.storage.local.remove(SITES_STORAGE_KEY);
    console.log(`[ConnectedSites] Disconnected all ${count} sites`);
  }

  async recordVerification(record: VerificationRecord): Promise<void> {
    console.log(`[ConnectedSites] 📝 Recording verification: ${record.id}`);
    console.log(`[ConnectedSites]    Origin: ${record.origin}`);
    console.log(`[ConnectedSites]    Address index: ${record.addressIndex}`);
    console.log(`[ConnectedSites]    Tree indices: (${record.treeIndices.l1}, ${record.treeIndices.l2}, ${record.treeIndices.l3})`);

    this.verifications.set(record.id, record);
    await this.persistVerifications();
  }

  getVerification(id: string): VerificationRecord | undefined {
    return this.verifications.get(id);
  }

  getVerificationsByOrigin(origin: string): VerificationRecord[] {
    const normalized = this.normalizeOrigin(origin);
    return Array.from(this.verifications.values())
      .filter(v => v.origin === normalized)
      .sort((a, b) => b.signedAt - a.signedAt);
  }

  async cleanupExpiredVerifications(): Promise<number> {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, record] of this.verifications.entries()) {
      if (record.expiresAt <= now) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      this.verifications.delete(id);
    }

    if (expiredIds.length > 0) {
      await this.persistVerifications();
      console.log(`[ConnectedSites] Cleaned up ${expiredIds.length} expired verifications`);
    }

    return expiredIds.length;
  }

  private normalizeOrigin(origin: string): string {
    try {
      const url = new URL(origin);
      return url.origin.toLowerCase();
    } catch {
      return origin.toLowerCase().replace(/\/$/, '');
    }
  }

  async initialize(): Promise<void> {
    await this.load();
    await this.cleanupExpiredVerifications();
  }

  hasPermission(origin: string, permission: keyof SitePermissions): boolean {
    const site = this.getSite(origin);
    return site?.permissions[permission] ?? false;
  }

  async grantTransactionPermission(
    origin: string,
    config: {
      allowedIntents: DAppTransactionIntent[];
      tokenLimits: TokenSpendingLimit[];
      expiresInDays?: number;
    }
  ): Promise<boolean> {
    const site = this.getSite(origin);
    if (!site) {
      console.error(`[ConnectedSites] Cannot grant tx permission - site not connected: ${origin}`);
      return false;
    }

    const now = Date.now();
    const expiresInMs = (config.expiresInDays || 30) * 24 * 60 * 60 * 1000;

    site.permissions.canSendTransaction = true;
    site.transactionPermissions = {
      grantedAt: now,
      expiresAt: now + expiresInMs,
      allowedIntents: config.allowedIntents,
      tokenLimits: config.tokenLimits,
      totalTransactions: 0
    };

    await this.persistSites();
    console.log(`[ConnectedSites] ✅ Granted transaction permission to ${origin}:`, {
      intents: config.allowedIntents,
      tokenCount: config.tokenLimits.length,
      expiresAt: new Date(site.transactionPermissions.expiresAt).toISOString()
    });

    return true;
  }

  async revokeTransactionPermission(origin: string): Promise<boolean> {
    const site = this.getSite(origin);
    if (!site) {
      return false;
    }

    site.permissions.canSendTransaction = false;
    site.transactionPermissions = undefined;

    await this.persistSites();
    console.log(`[ConnectedSites] 🚫 Revoked transaction permission from ${origin}`);

    return true;
  }

  getTransactionPermission(origin: string): SiteTransactionPermissions | undefined {
    const site = this.getSite(origin);
    if (!site || !site.transactionPermissions) {
      return undefined;
    }

    if (Date.now() > site.transactionPermissions.expiresAt) {
      console.log(`[ConnectedSites] Transaction permission expired for ${origin}`);
      return undefined;
    }

    return site.transactionPermissions;
  }

  canExecuteTransaction(
    origin: string,
    intent: DAppTransactionIntent,
    tokenId: string,
    amount: string
  ): { allowed: boolean; reason?: string } {
    const site = this.getSite(origin);
    if (!site) {
      return { allowed: false, reason: 'Site not connected' };
    }

    if (!site.permissions.canSendTransaction) {
      return { allowed: false, reason: 'Transaction permission not granted' };
    }

    const txPerm = site.transactionPermissions;
    if (!txPerm) {
      return { allowed: false, reason: 'No transaction permissions configured' };
    }

    if (Date.now() > txPerm.expiresAt) {
      return { allowed: false, reason: 'Transaction permission expired' };
    }

    if (!txPerm.allowedIntents.includes(intent)) {
      return { allowed: false, reason: `Intent "${intent}" not allowed for this site` };
    }

    const tokenLimit = txPerm.tokenLimits.find(t => t.tokenId === tokenId);
    if (!tokenLimit) {
      return { allowed: false, reason: `Token ${tokenId} not in allowlist` };
    }

    const amountBig = decimalToBigInt(amount);
    const maxPerTxBig = decimalToBigInt(tokenLimit.maxAmountPerTx);
    if (amountBig > maxPerTxBig) {
      return { allowed: false, reason: `Amount ${amount} exceeds per-transaction limit of ${tokenLimit.maxAmountPerTx}` };
    }

    const today = new Date().toISOString().split('T')[0];
    let dailyUsedBig = decimalToBigInt(tokenLimit.dailyUsed);
    if (tokenLimit.lastResetDate !== today) {
      dailyUsedBig = 0n;
    }

    const maxDailyBig = decimalToBigInt(tokenLimit.maxDailyAmount);
    if (dailyUsedBig + amountBig > maxDailyBig) {
      return { allowed: false, reason: `Would exceed daily limit. Used: ${tokenLimit.dailyUsed}, Limit: ${tokenLimit.maxDailyAmount}` };
    }

    return { allowed: true };
  }

  async recordTransaction(origin: string, tokenId: string, amount: string): Promise<void> {
    const site = this.getSite(origin);
    if (!site || !site.transactionPermissions) {
      return;
    }

    const txPerm = site.transactionPermissions;
    txPerm.totalTransactions += 1;
    txPerm.lastTransactionAt = Date.now();

    const tokenLimit = txPerm.tokenLimits.find(t => t.tokenId === tokenId);
    if (tokenLimit) {
      const today = new Date().toISOString().split('T')[0];
      if (tokenLimit.lastResetDate !== today) {
        tokenLimit.dailyUsed = '0';
        tokenLimit.lastResetDate = today;
      }
      const currentUsedBig = decimalToBigInt(tokenLimit.dailyUsed);
      const txAmountBig = decimalToBigInt(amount);
      tokenLimit.dailyUsed = bigIntToDecimal(currentUsedBig + txAmountBig);
    }

    await this.persistSites();
    console.log(`[ConnectedSites] 📊 Recorded transaction for ${origin}:`, {
      tokenId,
      amount,
      totalTransactions: txPerm.totalTransactions
    });
  }

  getSitesWithTransactionPermissions(): ConnectedSite[] {
    return Array.from(this.sites.values())
      .filter(site => site.permissions.canSendTransaction && site.transactionPermissions);
  }
}

export const connectedSitesStore = new ConnectedSitesStore();

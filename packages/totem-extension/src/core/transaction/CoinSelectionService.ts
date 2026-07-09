export class CoinSelectionError extends Error {
  constructor(
    message: string,
    public readonly code: 'FETCH_FAILED' | 'INSUFFICIENT_FUNDS' | 'SERVICE_UNAVAILABLE' | 'NETWORK_ERROR',
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CoinSelectionError';
  }
}

export interface SpendableCoin {
  coinId: string;
  address: string;
  amount: string;
  tokenid: string;
  created: number;
}

export interface CoinSelectionResult {
  selectedCoins: SpendableCoin[];
  totalSelected: string;
  change: string;
  insufficientFunds: boolean;
  fromAddresses: string[];
}

export type SendMode = 'global' | 'focused';

export interface CoinSelectionOptions {
  mode: SendMode;
  targetAmount: string;
  tokenId?: string;
  focusedAddress?: string;
  excludedAddresses?: string[];
}

const MINIMA_DECIMALS = 44;  // Minima uses 44 decimal precision
const SCALE = BigInt(10) ** BigInt(MINIMA_DECIMALS);

function parseDecimalToBigInt(value: string): bigint {
  const clean = (value || '0').trim();
  const parts = clean.split('.');
  const intPart = parts[0] || '0';
  let fracPart = parts[1] || '';
  
  if (fracPart.length > MINIMA_DECIMALS) {
    fracPart = fracPart.slice(0, MINIMA_DECIMALS);
  } else {
    fracPart = fracPart.padEnd(MINIMA_DECIMALS, '0');
  }
  
  return BigInt(intPart) * SCALE + BigInt(fracPart);
}

function bigIntToDecimalString(value: bigint): string {
  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;
  
  const intPart = absValue / SCALE;
  const fracPart = absValue % SCALE;
  
  const fracStr = fracPart.toString().padStart(MINIMA_DECIMALS, '0').replace(/0+$/, '');
  
  const sign = isNegative ? '-' : '';
  if (fracStr.length === 0) {
    return sign + intPart.toString();
  }
  return sign + intPart.toString() + '.' + fracStr;
}

function addDecimalStrings(a: string, b: string): string {
  return bigIntToDecimalString(parseDecimalToBigInt(a) + parseDecimalToBigInt(b));
}

function subtractDecimalStrings(a: string, b: string): string {
  return bigIntToDecimalString(parseDecimalToBigInt(a) - parseDecimalToBigInt(b));
}

function compareDecimal(a: string, b: string): number {
  const bigA = parseDecimalToBigInt(a);
  const bigB = parseDecimalToBigInt(b);
  if (bigA < bigB) return -1;
  if (bigA > bigB) return 1;
  return 0;
}

function isPositive(value: string): boolean {
  return parseDecimalToBigInt(value) > 0n;
}

function normAddr(a: string): string { return (a || '').toLowerCase(); }
function normToken(t: string): string { return (t || '').toLowerCase(); }

class CoinSelectionService {
  private apiKey: string | null = null;
  private excludedAddresses: Set<string> = new Set();
  
  setApiKey(key: string): void {
    this.apiKey = key;
  }
  
  async loadExcludedAddresses(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['excludedAddresses'], (result) => {
          if (result.excludedAddresses && Array.isArray(result.excludedAddresses)) {
            this.excludedAddresses = new Set(result.excludedAddresses);
          }
          resolve();
        });
      });
    }
  }
  
  async saveExcludedAddresses(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({
          excludedAddresses: Array.from(this.excludedAddresses)
        }, resolve);
      });
    }
  }
  
  addExcludedAddress(address: string): void {
    this.excludedAddresses.add(address);
    this.saveExcludedAddresses();
  }
  
  removeExcludedAddress(address: string): void {
    this.excludedAddresses.delete(address);
    this.saveExcludedAddresses();
  }
  
  getExcludedAddresses(): string[] {
    return Array.from(this.excludedAddresses);
  }
  
  isAddressExcluded(address: string): boolean {
    return this.excludedAddresses.has(address);
  }
  
  async getApiBaseUrl(): Promise<string> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['AXIA_BASE'], (result) => {
          resolve(result.AXIA_BASE || 'https://api.axia.to');
        });
      });
    }
    return 'https://api.axia.to';
  }
  
  async fetchSpendableCoins(
    addresses: string[],
    tokenId: string = '0x00'
  ): Promise<SpendableCoin[]> {
    const baseUrl = await this.getApiBaseUrl();
    
    // Use x-project-id for Totem-specific endpoints (bypasses credits, uses MegaMMR)
    // The /v1/wallet/coins endpoint requires 'totem-shared' project ID
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-project-id': 'totem-shared'
    };
    
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/wallet/coins`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ addresses, tokenId })
      });
    } catch (networkError: any) {
      throw new CoinSelectionError(
        'Network error fetching coins - check connection',
        'NETWORK_ERROR',
        { originalError: networkError.message }
      );
    }
    
    if (!response.ok) {
      let errorData: any = { error: 'Unknown error' };
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: `HTTP ${response.status}` };
      }
      
      if (response.status === 401 || response.status === 403) {
        throw new CoinSelectionError(
          'Wallet authentication failed - please reinitialize wallet',
          'FETCH_FAILED',
          { status: response.status, error: errorData.error, code: errorData.code }
        );
      }
      
      if (response.status === 503 || response.status === 502) {
        throw new CoinSelectionError(
          'Coin lookup service temporarily unavailable',
          'SERVICE_UNAVAILABLE',
          { status: response.status, error: errorData.error }
        );
      }
      
      throw new CoinSelectionError(
        errorData.error || `Failed to fetch coins: ${response.status}`,
        'FETCH_FAILED',
        { status: response.status, error: errorData.error }
      );
    }
    
    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new CoinSelectionError(
        'Invalid response from coin lookup service',
        'FETCH_FAILED',
        { reason: 'JSON parse error' }
      );
    }
    
    if (!Array.isArray(data.coins)) {
      return [];
    }
    
    const validatedCoins: SpendableCoin[] = [];
    const invalidCount = { count: 0 };
    
    for (const coin of data.coins) {
      if (!coin || typeof coin !== 'object') {
        invalidCount.count++;
        continue;
      }
      
      const coinId = coin.coinId || coin.coinid;
      if (typeof coinId !== 'string' || !coinId.startsWith('0x')) {
        invalidCount.count++;
        continue;
      }
      
      if (typeof coin.address !== 'string' || (!coin.address.startsWith('0x') && !coin.address.startsWith('Mx'))) {
        invalidCount.count++;
        continue;
      }
      
      if (typeof coin.amount !== 'string' || coin.amount.length === 0) {
        invalidCount.count++;
        continue;
      }
      
      const tokenId = coin.tokenId || coin.tokenid || '0x00';
      
      validatedCoins.push({
        coinId: coinId,
        address: coin.address,
        amount: coin.amount,
        tokenid: tokenId,
        created: typeof coin.created === 'number' ? coin.created : 0
      });
    }
    
    if (invalidCount.count > 0) {
      console.warn(`[CoinSelection] Filtered ${invalidCount.count} invalid coins from response`);
    }
    
    return validatedCoins;
  }
  
  orderCoinsByAmount(coins: SpendableCoin[]): SpendableCoin[] {
    return [...coins].sort((a, b) => {
      const cmp = compareDecimal(b.amount, a.amount);
      if (cmp !== 0) return cmp;
      return a.coinId.localeCompare(b.coinId);
    });
  }
  
  selectCoins(
    coins: SpendableCoin[],
    options: CoinSelectionOptions
  ): CoinSelectionResult {
    let availableCoins = [...coins];
    
    if (options.mode === 'focused' && options.focusedAddress) {
      const normFocused = normAddr(options.focusedAddress);
      availableCoins = availableCoins.filter(c => normAddr(c.address) === normFocused);
    }
    
    const exclusions = options.excludedAddresses || this.getExcludedAddresses();
    if (exclusions.length > 0 && options.mode === 'global') {
      availableCoins = availableCoins.filter(c => !exclusions.includes(c.address));
    }
    
    if (options.tokenId && options.tokenId !== '0x00') {
      const normTok = normToken(options.tokenId);
      availableCoins = availableCoins.filter(c => normToken(c.tokenid) === normTok);
    }
    
    const orderedCoins = this.orderCoinsByAmount(availableCoins);

    // For custom tokens the coin.amount from the MegaMMR `coins` RPC is the
    // Minima backing amount (10^-44), NOT the token display amount.  Accumulating
    // backing amounts and comparing against the user's intended send amount
    // (e.g. "1" or "6") always produces insufficientFunds=true.  Instead, return
    // all matching coins and let the transaction assembler handle the rest —
    // insufficientFunds is only true when no coins exist at all.
    const isCustomToken = !!(options.tokenId && options.tokenId !== '0x00');
    if (isCustomToken) {
      return {
        selectedCoins: orderedCoins,
        totalSelected: orderedCoins.reduce((s, c) => addDecimalStrings(s, c.amount), '0'),
        change: '0',
        insufficientFunds: orderedCoins.length === 0,
        fromAddresses: [...new Set(orderedCoins.map(c => c.address))],
      };
    }
    
    const targetBigInt = parseDecimalToBigInt(options.targetAmount);
    let accumulatedBigInt = 0n;
    const selectedCoins: SpendableCoin[] = [];
    const fromAddresses = new Set<string>();
    
    for (const coin of orderedCoins) {
      if (accumulatedBigInt >= targetBigInt) break;
      
      selectedCoins.push(coin);
      accumulatedBigInt += parseDecimalToBigInt(coin.amount);
      fromAddresses.add(coin.address);
    }
    
    const totalSelected = bigIntToDecimalString(accumulatedBigInt);
    const insufficientFunds = accumulatedBigInt < targetBigInt;
    const change = insufficientFunds 
      ? '0' 
      : bigIntToDecimalString(accumulatedBigInt - targetBigInt);
    
    return {
      selectedCoins,
      totalSelected,
      change,
      insufficientFunds,
      fromAddresses: Array.from(fromAddresses)
    };
  }
  
  async selectCoinsForSend(
    allAddresses: string[],
    options: CoinSelectionOptions
  ): Promise<CoinSelectionResult> {
    let addressesToQuery: string[];
    
    if (options.mode === 'focused' && options.focusedAddress) {
      addressesToQuery = [options.focusedAddress];
    } else {
      const exclusions = options.excludedAddresses || this.getExcludedAddresses();
      addressesToQuery = allAddresses.filter(addr => !exclusions.includes(addr));
    }
    
    if (addressesToQuery.length === 0) {
      return {
        selectedCoins: [],
        totalSelected: '0',
        change: '0',
        insufficientFunds: true,
        fromAddresses: []
      };
    }
    
    const coins = await this.fetchSpendableCoins(addressesToQuery, options.tokenId);
    return this.selectCoins(coins, options);
  }
  
  formatCoinInputs(coins: SpendableCoin[]): Array<{ coinId: string }> {
    return coins.map(c => ({ coinId: c.coinId }));
  }
}

export const coinSelectionService = new CoinSelectionService();

export {
  parseDecimalToBigInt,
  bigIntToDecimalString,
  addDecimalStrings,
  subtractDecimalStrings,
  compareDecimal,
  isPositive,
  CoinSelectionService
};

import type { KeyValueStorage, CoinFetcher, SpendableCoin } from './adapters.js';
export type { SpendableCoin } from './adapters.js';

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

const MINIMA_DECIMALS = 44;
const SCALE = BigInt(10) ** BigInt(MINIMA_DECIMALS);

const DECIMAL_RE = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,44})?$/;

export function parseDecimalToBigInt(value: string): bigint {
  const clean = (value || '0').trim();
  if (!DECIMAL_RE.test(clean)) {
    throw new CoinSelectionError(`Invalid decimal format: "${value}"`, 'INSUFFICIENT_FUNDS');
  }
  const isNegative = clean.startsWith('-');
  const abs = isNegative ? clean.slice(1) : clean;
  const parts = abs.split('.');
  const intPart = parts[0] || '0';
  let fracPart = parts[1] || '';

  if (fracPart.length > MINIMA_DECIMALS) {
    fracPart = fracPart.slice(0, MINIMA_DECIMALS);
  } else {
    fracPart = fracPart.padEnd(MINIMA_DECIMALS, '0');
  }

  const result = BigInt(intPart) * SCALE + BigInt(fracPart);
  return isNegative ? -result : result;
}

export function bigIntToDecimalString(value: bigint): string {
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

export function addDecimalStrings(a: string, b: string): string {
  return bigIntToDecimalString(parseDecimalToBigInt(a) + parseDecimalToBigInt(b));
}

export function subtractDecimalStrings(a: string, b: string): string {
  return bigIntToDecimalString(parseDecimalToBigInt(a) - parseDecimalToBigInt(b));
}

export function compareDecimal(a: string, b: string): number {
  const bigA = parseDecimalToBigInt(a);
  const bigB = parseDecimalToBigInt(b);
  if (bigA < bigB) return -1;
  if (bigA > bigB) return 1;
  return 0;
}

export function isPositive(value: string): boolean {
  return parseDecimalToBigInt(value) > 0n;
}

export class CoinSelectionService {
  private excludedAddresses: Set<string> = new Set();
  private storage: KeyValueStorage | null;
  private fetcher: CoinFetcher;
  
  constructor(fetcher: CoinFetcher, storage?: KeyValueStorage) {
    this.fetcher = fetcher;
    this.storage = storage || null;
  }
  
  async loadExcludedAddresses(): Promise<void> {
    if (!this.storage) return;
    const data = await this.storage.get<string[]>('excludedAddresses');
    if (data && Array.isArray(data)) {
      this.excludedAddresses = new Set(data);
    }
  }
  
  async saveExcludedAddresses(): Promise<void> {
    if (!this.storage) return;
    await this.storage.set('excludedAddresses', Array.from(this.excludedAddresses));
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
  
  async fetchSpendableCoins(addresses: string[], tokenId: string = '0x00'): Promise<SpendableCoin[]> {
    return this.fetcher.fetchCoins(addresses, tokenId);
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
      availableCoins = availableCoins.filter(c => c.address === options.focusedAddress);
    }
    
    const exclusions = options.excludedAddresses || this.getExcludedAddresses();
    if (exclusions.length > 0 && options.mode === 'global') {
      availableCoins = availableCoins.filter(c => !exclusions.includes(c.address));
    }
    
    if (options.tokenId && options.tokenId !== '0x00') {
      availableCoins = availableCoins.filter(c => c.tokenid === options.tokenId);
    }
    
    const orderedCoins = this.orderCoinsByAmount(availableCoins);
    
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

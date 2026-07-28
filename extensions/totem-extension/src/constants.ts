/**
 * Totem Constants
 * Global configuration values for the extension
 */

/**
 * Minima blockchain uses 44 decimal places for all amounts
 * 1 MINIMA = 10^44 base units
 */
export const MINIMA_DECIMALS = 44;

/**
 * Scale factor for converting between MINIMA display amounts and base units
 * Use this for all BigInt calculations involving amounts
 * 
 * Example:
 *   Display: "1.5" MINIMA
 *   Base units: BigInt("15") * MINIMA_SCALE / BigInt("10")
 */
export const MINIMA_SCALE = BigInt(10) ** BigInt(MINIMA_DECIMALS);

/**
 * Format a base unit amount (BigInt string) to display format with decimals
 * @param baseUnits - Amount in base units as string
 * @param decimals - Number of decimal places to show (default: 4)
 * @returns Formatted string like "1.2345"
 */
export function formatMinimaAmount(baseUnits: string, decimals: number = 4): string {
  try {
    const value = BigInt(baseUnits);
    const wholePart = value / MINIMA_SCALE;
    const fractionalPart = value % MINIMA_SCALE;
    
    // Convert fractional part to decimal string with proper padding
    const fractionalStr = fractionalPart.toString().padStart(MINIMA_DECIMALS, '0');
    const trimmed = fractionalStr.slice(0, decimals).replace(/0+$/, '');
    
    if (trimmed === '') {
      return wholePart.toString();
    }
    
    return `${wholePart}.${trimmed}`;
  } catch (error) {
    console.error('Error formatting Minima amount:', error);
    return '0';
  }
}

/**
 * Format a display-unit amount string for UI rendering.
 * Minima RPC balance/transaction APIs return values in display format (e.g., "16" means
 * 16 Minima, "0.01" means 0.01 tokens). This function formats those for consistent display.
 * 
 * For raw 44-decimal base units, use formatMinimaAmount() directly instead.
 * 
 * @param value - Amount as display-format string (e.g., "16", "0.01", "1000.5")
 * @param decimals - Number of decimal places to show (default: 4)
 * @returns Formatted string like "16.00", "0.01"
 */
export function formatAmount(value: string, decimals: number = 4): string {
  if (!value || value === '') return '0';
  
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  if (num === 0) return '0';
  if (num < 0.0001) return num.toFixed(8);
  if (num < 1) return num.toFixed(decimals);
  if (num >= 1000000) return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return num.toFixed(2);
}

/**
 * Parse a display amount string to base units (BigInt compatible string)
 * @param displayAmount - Amount as string like "1.2345"
 * @returns Base units as string for BigInt conversion
 */
export function parseMinimaAmount(displayAmount: string): string {
  try {
    const [whole = '0', fractional = ''] = displayAmount.split('.');
    const wholeBigInt = BigInt(whole) * MINIMA_SCALE;
    
    if (!fractional) {
      return wholeBigInt.toString();
    }
    
    // Pad or truncate fractional part to exactly MINIMA_DECIMALS
    const paddedFractional = fractional.padEnd(MINIMA_DECIMALS, '0').slice(0, MINIMA_DECIMALS);
    const fractionalBigInt = BigInt(paddedFractional);
    
    return (wholeBigInt + fractionalBigInt).toString();
  } catch (error) {
    console.error('Error parsing Minima amount:', error);
    return '0';
  }
}

/**
 * Parse a Minima token image URL into a usable image source.
 * Handles:
 *  - `<artimage>...` prefix: embedded base64 JPEG/PNG data → data: URL
 *  - `data:image/...` URIs: passed through unchanged
 *  - HTTP/HTTPS URLs: passed through unchanged
 *  - IPFS URLs in various formats: converted to a public gateway URL
 *    (ipfs://<cid>, ipfs://ipfs/<cid>, ipfs/<cid>)
 *  - Anything else: returns undefined
 */
function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function detectImageMimeFromHex(hex: string): string | undefined {
  const lower = hex.toLowerCase();
  if (lower.startsWith('89504e47')) return 'image/png';
  if (lower.startsWith('ffd8ff')) return 'image/jpeg';
  if (lower.startsWith('47494638')) return 'image/gif';
  if (lower.startsWith('52494646') && lower.substring(16, 24) === '57454250') return 'image/webp';
  if (lower.startsWith('3c737667') || lower.startsWith('3c3f786d')) return 'image/svg+xml';
  return undefined;
}

export function parseTokenImageUrl(url?: string): string | undefined {
  if (!url || url.trim() === '') return undefined;

  const trimmed = url.trim();

  if (trimmed.startsWith('<artimage>')) {
    let base64Data = trimmed.slice('<artimage>'.length).trim();
    if (base64Data.endsWith('</artimage>')) {
      base64Data = base64Data.slice(0, -'</artimage>'.length).trim();
    }
    if (!base64Data) return undefined;
    if (base64Data.startsWith('data:image/')) {
      return base64Data;
    }
    if (base64Data.startsWith('iVBOR')) {
      return `data:image/png;base64,${base64Data}`;
    }
    return `data:image/jpeg;base64,${base64Data}`;
  }

  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('ipfs://')) {
    let path = trimmed.slice('ipfs://'.length);
    if (path.startsWith('ipfs/')) {
      path = path.slice('ipfs/'.length);
    }
    return `https://ipfs.io/ipfs/${path}`;
  }

  if (trimmed.startsWith('ipfs/')) {
    const path = trimmed.slice('ipfs/'.length);
    return `https://ipfs.io/ipfs/${path}`;
  }

  const hexBody = trimmed.startsWith('0x') ? trimmed.slice(2) : null;
  if (hexBody && hexBody.length >= 8 && /^[0-9a-fA-F]+$/.test(hexBody)) {
    const mime = detectImageMimeFromHex(hexBody);
    if (mime) {
      try {
        const base64 = hexToBase64(hexBody);
        return `data:${mime};base64,${base64}`;
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

/**
 * Default RPC configuration
 */
export const DEFAULT_RPC_ENDPOINT = 'https://api.axia.to';
export const DEFAULT_PROJECT_ID = 'totem-shared';

/**
 * Session constants
 */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const AUTO_LOCK_ENABLED = true;
export const AUTO_LOCK_OPTIONS_MINUTES = [1, 5, 15, 30, 60] as const;
export const DEFAULT_AUTO_LOCK_MINUTES = 30;

/**
 * Provider chain identifier for Minima Mainnet.
 * Used in TOTEM_GET_ACCOUNTS and other dApp-facing provider responses.
 * Single source of truth — do not hardcode 'minima-mainnet' elsewhere.
 */
export const TOTEM_CHAIN_ID = 'minima-mainnet';

/**
 * WOTS constants
 */
export const WOTS_TREE_DEPTH = 3; // L1, L2, L3
export const WOTS_ADDRESSES_PER_LEVEL = 64;
export const WOTS_TOTAL_ADDRESSES = WOTS_ADDRESSES_PER_LEVEL; // 64 addresses per root key

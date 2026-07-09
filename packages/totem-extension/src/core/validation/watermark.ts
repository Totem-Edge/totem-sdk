/**
 * Watermark Validation
 * Pre-flight checks before transaction signing
 * 
 * Updated 2026-02-05 for Per-Address TreeKey Architecture
 */

import { watermarkStore } from '../stores';

export class WatermarkExhaustedError extends Error {
  constructor(public addressIndex?: number) {
    super(
      addressIndex !== undefined
        ? `Address ${addressIndex} has exhausted all WOTS signatures.`
        : 'All WOTS signatures have been used. Please create a new wallet.'
    );
    this.name = 'WatermarkExhaustedError';
  }
}

/**
 * Validate watermark has available signatures before transaction prepare
 * For per-address architecture, checks if the specified address has capacity
 */
export async function validateWatermarkBeforePrepare(
  rootPublicKey: string,
  addressIndex?: number
): Promise<void> {
  await watermarkStore.initialize();
  
  // If specific address provided, check that address
  if (addressIndex !== undefined) {
    if (watermarkStore.isAddressExhausted(addressIndex)) {
      throw new WatermarkExhaustedError(addressIndex);
    }
    return;
  }
  
  // Otherwise check if any address has capacity
  if (!watermarkStore.hasAvailableIndices()) {
    throw new WatermarkExhaustedError();
  }
}

/**
 * Validate a specific address has available signatures
 */
export async function validateAddressCapacity(addressIndex: number): Promise<void> {
  await watermarkStore.initialize();
  
  if (watermarkStore.isAddressExhausted(addressIndex)) {
    throw new WatermarkExhaustedError(addressIndex);
  }
}

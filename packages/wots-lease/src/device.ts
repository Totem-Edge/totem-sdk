/**
 * Device keyspace partitioning — Layer 2.
 *
 * Deterministic address-index range assignment per device slot.
 * Does NOT accept a raw seed; the caller derives the TreeKey in @totemsdk/core.
 *
 * Layout (8 device slots × 8 addresses each = 64 total):
 *   device 0 → addressIndex 0–7
 *   device 1 → addressIndex 8–15
 *   device 2 → addressIndex 16–23
 *   ...
 */

import type { DeviceKeyRange } from './types.js';

const ADDRESSES_PER_DEVICE = 8;
const MAX_DEVICE_SLOTS = 8;

export function allocateDeviceRange(params: {
  deviceSlot: number;
  deviceId: string;
}): DeviceKeyRange {
  if (params.deviceSlot < 0 || params.deviceSlot >= MAX_DEVICE_SLOTS) {
    throw new RangeError(
      `Device slot must be 0–${MAX_DEVICE_SLOTS - 1}, got ${params.deviceSlot}`,
    );
  }
  const startAddressIndex = params.deviceSlot * ADDRESSES_PER_DEVICE;
  const endAddressIndex = startAddressIndex + ADDRESSES_PER_DEVICE - 1;
  return {
    deviceId: params.deviceId,
    startAddressIndex,
    endAddressIndex,
    addressCount: ADDRESSES_PER_DEVICE,
  };
}

export function deviceSlotForAddressIndex(addressIndex: number): number {
  return Math.floor(addressIndex / ADDRESSES_PER_DEVICE);
}

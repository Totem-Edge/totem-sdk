/**
 * CRC-16/CCITT-FALSE, as used by the edge-mesh packet header.
 *
 * Matches `crc16()` in hawk-node/ble/frame_codec.cpp. The shared conformance
 * vectors in test-vectors/mesh-v1.json pin both implementations.
 */
export function crc16(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

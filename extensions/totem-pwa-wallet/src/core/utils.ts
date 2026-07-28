/** Browser-safe hex utilities (no Node Buffer) */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function fromHex(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const arr = new Uint8Array(h.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

export const bytesToHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();

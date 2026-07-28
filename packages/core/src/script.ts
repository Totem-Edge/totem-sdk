import { bytesToHex } from "./util.js";
import { scriptToAddress } from "./derive.js";
import type { WotsKeypair } from "./wots.js";

/** Produce KISSVM script that authorizes with a WOTS PK digest (32 bytes). */
export function scriptFromWotsPk(pkDigest32: Uint8Array): string {
  // Minima uses SHA3-256 in SIGNEDBY paths; here we embed the digest as hex.
  return `RETURN SIGNEDBY(${bytesToHex(pkDigest32)})`;
}

/** Address from WOTS keypair (client-only): script -> MMR leaf -> Mx */
export function wotsAddressFromKeypair(kp: WotsKeypair): string {
  const script = scriptFromWotsPk(kp.pk);
  return scriptToAddress(script);
}

/** tiny utils */
export function hexToBytes(hex: string): Uint8Array {
  let h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2) h = "0" + h;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
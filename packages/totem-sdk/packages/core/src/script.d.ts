import type { WotsKeypair } from "./wots";
/** Produce KISSVM script that authorizes with a WOTS PK digest (32 bytes). */
export declare function scriptFromWotsPk(pkDigest32: Uint8Array): string;
/** Address from WOTS keypair (client-only): script -> MMR leaf -> Mx */
export declare function wotsAddressFromKeypair(kp: WotsKeypair): string;
/** tiny utils */
export declare function hexToBytes(hex: string): Uint8Array;

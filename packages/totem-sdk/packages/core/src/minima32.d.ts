export declare function encodeMxRadix32Frame(frame: Uint8Array): string;
export declare function decodeMxRadix32Frame(mx: string): Uint8Array;
/** Encode raw 32 bytes to Mx address with frame and checksum */
export declare function encodeMx(root32: Uint8Array): string;
/** Decode Mx address to raw 32 bytes, validating frame and checksum */
export declare function decodeMx(mx: string): Uint8Array;
/** Make an Mx address from a hex string (legacy API compatibility) */
export declare function makeMinimaAddress(hex: string): string;
/** Convert an Mx address back to uppercase hex (legacy API compatibility) */
export declare function convertMinimaAddress(mx: string): string;

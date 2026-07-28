/**
 * Utility functions for byte array manipulation
 */
export declare function bytesToHex(bytes: Uint8Array): string;
export declare function hexToBytes(hex: string): Uint8Array;
export declare function concatBytes(...arrays: Uint8Array[]): Uint8Array;
export declare function utf8ToBytes(str: string): Uint8Array;
export declare function bytesToUtf8(bytes: Uint8Array): string;

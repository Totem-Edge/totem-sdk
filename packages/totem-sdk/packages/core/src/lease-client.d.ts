/**
 * Totem <-> Axia hardened WOTS helpers (no deps on server internals).
 */
export type PrepareArgs = {
    txId: string;
    rootPublicKey: string;
    to: string;
    amount: string;
    tokenId?: string;
    burn?: string | null;
    digestL2?: string | null;
    digestL3?: string | null;
    ttlMs?: number;
};
export type PrepareResp = {
    leaseToken: string;
    lease: {
        addressIndex: number;
        l1: number;
        l2: number;
    };
    txId: string;
    digestTx?: string | null;
};
export declare function prepareLease(apiUrl: string, apiKey: string, args: PrepareArgs): Promise<PrepareResp>;
export declare function finalizeLease(apiUrl: string, apiKey: string, leaseToken: string, signedHex: string): Promise<{
    status: number;
    body: string;
}>;
/** lane tuple -> flat WOTS index (64^3 space) */
export declare function flatIndexFromLanes(addressIndex: number, l1: number, l2: number): number;

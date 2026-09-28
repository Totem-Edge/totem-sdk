/**
 * `signtoken` token-authorship signing (RFC-005 #2/#11).
 *
 * Mirrors Minima `tokencreate`: the token coinId is signed (a DIFFERENT message
 * than the transaction digest) and the proof is embedded in the token metadata.
 * Because a WOTS leaf must sign exactly one message, the token signature MUST
 * use a distinct leaf from the transaction signature — this module requests a
 * fresh lease and refuses (throws) if it collides with the transaction leaf.
 *
 * Kept dependency-free (no chrome / noble imports) so it is unit-testable.
 */

export interface WotsLeaf {
  readonly addressIndex: number;
  readonly l1: number;
  readonly l2: number;
}

export interface SignTokenCoinIdParams {
  /** The transaction-signing leaf (must NOT be reused for the token). */
  readonly txLeaf: WotsLeaf;
  /** Requests a fresh WOTS lease for the token signature. */
  readonly requestLease: (params: {
    readonly txId: string;
    readonly addressIndex: number;
  }) => Promise<WotsLeaf>;
  /** Signs an arbitrary 32-byte digest with the given leaf. */
  readonly signTransactionPerAddress: (params: {
    readonly addressIndex: number;
    readonly l1: number;
    readonly l2: number;
    readonly digestTx: string;
  }) => Promise<{ signedHex: string }>;
  /** The token coinId (0x-prefixed hex) to sign. */
  readonly tokenCoinIdHex: string;
  readonly txId: string;
  readonly addressIndex: number;
}

/** Thrown when the token signature would reuse the transaction's WOTS leaf. */
export class TokenSignKeyReuseError extends Error {
  constructor() {
    super(
      'signtoken refused: token signature would reuse the transaction WOTS leaf (key reuse)',
    );
    this.name = 'TokenSignKeyReuseError';
  }
}

function leafKey(leaf: WotsLeaf): string {
  return `${Number(leaf.addressIndex)}:${Number(leaf.l1)}:${Number(leaf.l2)}`;
}

/**
 * Sign the token coinId with a dedicated WOTS leaf, returning the serialized
 * signature hex (`signedHex`). Throws {@link TokenSignKeyReuseError} if the
 * fresh lease returns the transaction leaf.
 */
export async function signTokenCoinId(params: SignTokenCoinIdParams): Promise<string> {
  const lease = await params.requestLease({
    txId: `tokensign-${params.txId}`,
    addressIndex: params.addressIndex,
  });

  if (leafKey(lease) === leafKey(params.txLeaf)) {
    throw new TokenSignKeyReuseError();
  }

  const sig = await params.signTransactionPerAddress({
    addressIndex: Number(lease.addressIndex),
    l1: Number(lease.l1),
    l2: Number(lease.l2),
    digestTx: params.tokenCoinIdHex,
  });

  return sig.signedHex;
}

/// WOTS+ parameter set for Minima blockchain.
///
/// Winternitz parameter w=8 (8 bits per digit), n=256 (SHA3-256 output),
/// L=34 chains (32 message + 2 checksum).
///
/// This matches the Java BouncyCastle-compatible implementation byte-for-byte.

/// Winternitz parameter — number of bits per digit.
pub const WOTS_W: usize = 8;

/// Hash output length in bytes (SHA3-256).
pub const WOTS_N: usize = 32;

/// Number of Winternitz chains: 32 message digits + 2 checksum digits.
pub const WOTS_L: usize = 34;

/// Maximum value of a single Winternitz digit (2^w - 1).
pub const MAX_DIGIT: u16 = 255;

/// Total number of signatures per TreeKey (64 addresses × 64 L1 × 64 L2).
pub const MAX_SIGNATURES: usize = 262_144;

/// Number of levels in the TreeKey hierarchy.
pub const SIGNATURE_LEVELS: usize = 3;

/// Number of children per TreeKeyNode.
pub const NODE_CHILDREN: usize = 64;

/// Minima address prefix.
pub const ADDRESS_PREFIX: &str = "Mx";

/// Network ID for mainnet.
pub const NETWORK_ID: u8 = 1;

/// Full WOTS signature length in bytes (L × N).
pub const SIGNATURE_LENGTH: usize = WOTS_L * WOTS_N;

/// Full WOTS public key length in bytes (L × N).
pub const PUBLIC_KEY_LENGTH: usize = WOTS_L * WOTS_N;

/// WOTS public key digest length (SHA3-256 of full public key).
pub const PK_DIGEST_LENGTH: usize = 32;

/// Seed length in bytes.
pub const SEED_LENGTH: usize = 32;

/// BIP39 mnemonic word count.
pub const MNEMONIC_WORD_COUNT: usize = 24;

/// BIP39 entropy bits.
pub const MNEMONIC_ENTROPY_BITS: usize = 256;

# Security FAQ

## Is Totem Wallet secure?

Yes. Totem Wallet uses quantum-resistant WOTS+ signatures and never exposes your private keys. All signing happens client-side.

## What makes WOTS quantum-resistant?

Winternitz One-Time Signatures (WOTS) are based on hash-based cryptography, which is believed to be resistant to attacks by quantum computers. Unlike ECDSA and RSA, which rely on the discrete logarithm and integer factorization problems (both breakable by Shor's algorithm), hash-based signatures rely only on the preimage resistance of the hash function.

## Can I reuse a WOTS key?

**No.** Each WOTS key index can only be used once. Reusing a key index allows an attacker to recover the private key. The Totem SDK enforces this through the lease/watermark coordination system. Each seed phrase provides 262,144 one-time signatures.

## How are my keys stored?

- **Browser Extension**: Encrypted with AES-256-GCM + PBKDF2 (200,000 iterations) in `chrome.storage.local`
- **PWA Wallet**: Encrypted with AES-256-GCM + PBKDF2 (210,000 iterations) in IndexedDB
- **Session keys**: Held in `Uint8Array` and zeroed on lock

## What happens if I lose my seed phrase?

Your seed phrase is the only way to recover your wallet. There is no password reset. Store your 24-word seed phrase securely offline.

## How do I report a security vulnerability?

See [SECURITY.md](../../SECURITY.md). Do not open a public GitHub issue.

## What cryptographic algorithms does Totem use?

| Purpose | Algorithm |
|---------|-----------|
| Signatures | WOTS+ (w=8, n=256, L=34) |
| Hashing | SHA3-256 (Keccak) |
| Encryption | AES-256-GCM |
| Key Derivation | PBKDF2 with SHA-256 |
| Ephemeral Keys | Ed25519 |

## Is Totem audited?

Security audits are ongoing. Contact security@totem.ing for the latest audit reports.

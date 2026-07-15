# Cryptographic Security Policy

This document defines the cryptographic security policies for the Totem SDK. All contributors and maintainers must adhere to these policies.

## 1. WOTS Key Reuse Prevention

**Policy**: No WOTS key index shall ever be used to sign more than one message.

**Rationale**: Winternitz One-Time Signatures (WOTS) are quantum-resistant but each key can only be used once. Reusing a key index allows an attacker to recover the private key through differential analysis of two signatures.

**Enforcement**:
- All WOTS key usage must go through the `@totemsdk/wots-lease` lease/watermark coordination system
- The `LeaseJournal` provides an append-only audit log of all key-use events
- Watermarks are monotonic and never decrease
- The `WatermarkMonotonicityError` is thrown if a watermark would decrease
- The `WatermarkExhaustedError` is thrown if all 262,144 signatures are used

**Reference**: `LEASE_WATERMARK_SPEC.md` for the complete specification.

## 2. Key Generation Entropy Requirements

**Policy**: All cryptographic key material must be generated with at least 256 bits of entropy from a cryptographically secure random number generator.

**Requirements**:
- Browser: `crypto.getRandomValues()` (Web Crypto API)
- Node.js: `crypto.randomBytes()`
- Pear/Bare: `crypto.getRandomValues()`
- **Prohibited**: `Math.random()`, `Date.now()`, or any non-cryptographic PRNG

**Seed Phrases**:
- Must use the official BIP39 English word list (2048 words)
- Must generate 24 words (256 bits of entropy)
- Must use SHA3-256 for seed derivation (Minima-compatible, no PBKDF2)

## 3. Secure Memory Handling

**Policy**: Private keys and seed material must be held in mutable buffers and zeroed after use.

**Requirements**:
- Private keys must be stored in `Uint8Array` (not strings) to enable zeroing
- After signing, call `.fill(0)` on all key material buffers
- Session seeds must be zeroed on wallet lock/logout
- Never log private keys, seed phrases, or derived addresses in telemetry
- Never include key material in error messages or stack traces

**Reference**: `packages/totem-extension/src/core/wallet.ts` lines 573-576 for the session seed zeroing pattern.

## 4. Constant-Time Comparison

**Policy**: All cryptographic comparisons must use constant-time comparison to prevent timing side-channel attacks.

**Requirements**:
- Use `timingSafeEqual(a, b)` from `@totemsdk/core` for all cryptographic comparisons
- **Prohibited**: `===`, `==`, `Buffer.compare()`, or `Array.every()` for comparing:
  - Signatures
  - Public keys
  - Hashes
  - MACs
  - Any secret-derived values

**Reference**: `packages/totem-sdk/packages/core/src/verify.ts` lines 148-155 for the `timingSafeEqual` implementation.

## 5. Side-Channel Attack Mitigation

**Policy**: Cryptographic code must not contain variable-time operations on secret data.

**Requirements**:
- No branching based on secret values (avoid `if` on secret data)
- No early-exit optimizations in cryptographic verification paths
- No array indexing based on secret values
- No `switch` statements on secret values
- Full signature verification must complete before returning any result

## 6. Random Number Generation

**Policy**: All cryptographic nonces must be generated from a CSPRNG with sufficient entropy.

**Requirements**:
- Nonce minimum length: 16 bytes (128 bits)
- Challenge nonces must include a timestamp for expiry enforcement
- Nonces must be unique per operation
- Nonces must not be reused across different operations

**Reference**: `packages/totem-sdk/packages/core/src/verify.ts` lines 173-179 for challenge generation.

## 7. Dependency Security

**Policy**: Cryptographic dependencies must be minimized and audited.

**Requirements**:
- `@noble/hashes` is the sole external cryptographic dependency
- No new cryptographic dependencies without security review by at least 2 maintainers
- All dependencies must be audited before major version bumps
- The lockfile (`pnpm-lock.yaml`) must be maintained and committed
- Dependabot alerts must be triaged within 14 days
- Critical severity alerts must be addressed within 72 hours

**Prohibited Dependencies**:
- Any unaudited cryptographic library
- Any library that implements its own cryptographic primitives
- Any library with known vulnerabilities without a fix

## 8. Audit Logging

**Policy**: All WOTS key lease operations must be recorded in an append-only audit log.

**Requirements**:
- Every lease operation (reserve, commit, burn, expire) must be recorded in the `LeaseJournal`
- Journal entries must include: tree ID, reservation ID, timestamp, operation type
- The journal must be append-only (no deletion or modification of entries)
- The journal must be tamper-evident

**Reference**: `packages/totem-sdk/packages/wots-lease/src/journal.ts` for the `LeaseJournal` implementation.

## 9. Code Review Requirements for Cryptographic Code

**Policy**: Changes to cryptographic code require enhanced review.

**Requirements**:
- All changes to `packages/totem-sdk/packages/core/` require review by at least 2 maintainers
- All changes to WOTS signing paths require parity test verification against the Java reference implementation
- All changes to key derivation paths require review of backward compatibility
- All changes to serialization code require byte-exact verification against Java output
- Security-critical changes must include a security impact assessment in the PR description

## 10. Encryption Standards

**Policy**: All encryption of sensitive data must use approved algorithms and parameters.

**Requirements**:
- **Symmetric encryption**: AES-256-GCM
- **Key derivation**: PBKDF2 with SHA-256, minimum 200,000 iterations
- **Hash function**: SHA3-256 (Keccak)
- **Digital signatures**: WOTS+ (w=8, n=256, L=34)
- **Ephemeral keys**: Ed25519 (for session authentication only, not for blockchain transactions)

**Prohibited**:
- AES in ECB mode
- DES, 3DES, RC4
- MD5, SHA-1
- RSA with key size < 2048 bits
- ECDSA with curves other than secp256k1 (for non-quantum-resistant contexts only)

## 11. Secure Storage

**Policy**: Sensitive data at rest must be encrypted.

**Requirements**:
- Seed phrases and private keys must be encrypted before storage
- Use AES-256-GCM with unique IV per encryption
- Use PBKDF2 with salt for password-derived keys
- Never store plaintext seeds or keys in localStorage, sessionStorage, or cookies
- Chrome extension: use `chrome.storage.local` for encrypted data
- PWA: use IndexedDB with AES-GCM encryption

**Reference**: `packages/totem-pwa-wallet/src/stores/VaultStore.ts` for the encrypted storage pattern.

## 12. Transport Security

**Policy**: All network communication must be encrypted.

**Requirements**:
- All HTTP communication must use HTTPS (TLS 1.2+)
- WebSocket connections must use WSS
- P2P communication must use Hyperswarm's built-in encryption
- API keys must be sent in headers, never in URL parameters
- Post-quantum TLS (X25519+Kyber768) should be used when available

## Compliance

Violations of these policies must be reported to security@totem.ing. All violations will be investigated and remediated according to the incident response process defined in `docs/admins/support/incident-response.md`.

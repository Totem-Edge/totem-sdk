[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / SignatureProof

# Interface: SignatureProof

SignatureProof structure matching Minima's SignatureProof.java

Contains:
- leafPubkey: The 32-byte WOTS public key DIGEST (SHA3-256 of full L×32 key)
- signature: The 1088-byte Winternitz signature (L×32 bytes)
- mmrProof: Proof linking the leaf pubkey to the tree node's root

CRITICAL FIX (January 2026): Java's Winternitz.getPublicKey() returns a 32-byte digest!

From BouncyCastle WinternitzOTSignature.getPublicKey() (lines 103-121):
  byte[] buf = new byte[keysize * mdsize];  // Full 1088 bytes (34×32)
  // ... hash each chain 255 times into buf ...
  messDigestOTS.update(buf, 0, buf.length);  // Hash the full key
  byte[] tmp = new byte[mdsize];             // 32 bytes
  messDigestOTS.doFinal(tmp, 0);             // SHA3-256
  return tmp;                                 // Returns 32-byte DIGEST!

Similarly, WinternitzOTSVerify.Verify() recovers the full key then hashes to 32 bytes.
Winternitz.verify() then compares the 32-byte recovered digest to mPublicKey (32 bytes).

Previous bug: We stored 1088-byte full keys, Java expected 32-byte digests → always failed.

## Properties

### leafPubkey

> **leafPubkey**: `Bytes`

***

### mmrProof

> **mmrProof**: [`MMRProof`](MMRProof.md)

***

### signature

> **signature**: `Bytes`

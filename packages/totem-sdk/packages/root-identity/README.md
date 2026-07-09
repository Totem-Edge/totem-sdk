# @totemsdk/root-identity

**One seed → up to 64 blockchain addresses, all cryptographically provable as one identity.**

`RootIdentityWallet` generates a hierarchy of up to 64 independent TreeKey addresses from a single root seed. Each child has its own full 3-level TreeKey (not shallow derivations that weaken each other), and zero-knowledge-style ownership proofs let you prove that a set of addresses share one root — without revealing the root itself.

## Install

```bash
npm install @totemsdk/root-identity
```

## What's inside

| Export | What it does |
|--------|-------------|
| `RootIdentityWallet` | Generates and manages up to 64 independent child addresses |
| `MAX_CHILD_COUNT` | `64` — maximum child addresses per wallet |
| `WotsProof` | *(type only)* Proof that a signing key belongs to a specific child address |
| `OwnershipProof` | *(type only)* Proof that multiple addresses share the same root — without revealing the root |

### `RootIdentityWallet` API

| Member | Type | What it does |
|--------|------|-------------|
| `new RootIdentityWallet(baseSeed, childCount?)` | constructor | Create from a raw 32-byte seed |
| `RootIdentityWallet.fromPhrase(phrase, childCount?)` | static method | Create from a BIP39 mnemonic (synchronous) |
| `RootIdentityWallet.generatePhrase()` | static method | Generate a fresh 24-word mnemonic string |
| `RootIdentityWallet.validatePhrase(phrase)` | static method | Check if a phrase is valid BIP39 |
| `RootIdentityWallet.verifyOwnershipProof(proof)` | static method | Verify an `OwnershipProof` without the root seed |

### Use cases

- **Chain-of-custody proofs** — prove an item passed through a series of addresses you control
- **DAO multi-address attestation** — vote or attest with multiple addresses, provably from one member
- **Privacy-preserving KYC** — selectively disclose which addresses belong to a verified identity
- **NFT / token ownership linking** — prove that assets across multiple addresses belong to one owner

## Usage

### Create a wallet and derive addresses

```typescript
import { RootIdentityWallet } from '@totemsdk/root-identity';

// Generate a fresh 24-word phrase
const phrase = RootIdentityWallet.generatePhrase();
console.log('Root phrase (store securely!):', phrase);

// Restore from phrase (synchronous)
const wallet = RootIdentityWallet.fromPhrase(phrase);

// Or create from a raw seed directly
// const wallet = new RootIdentityWallet(baseSeedBytes);
```

### Get child addresses

```typescript
const addr0 = wallet.getChildAddress(0);
const addr1 = wallet.getChildAddress(1);
console.log('Address 0:', addr0); // "Mx..."
```

### Prove shared ownership

```typescript
// Prove that child addresses 0 and 2 belong to the same root identity
const proof = wallet.proveOwnership([0, 2]);

// Anyone can verify this proof without learning the root seed
const ok = RootIdentityWallet.verifyOwnershipProof(proof);
console.log('Valid:', ok);
```

### Validate a phrase before using it

```typescript
const valid = RootIdentityWallet.validatePhrase(userInput);
if (!valid) throw new Error('Invalid seed phrase');
const wallet = RootIdentityWallet.fromPhrase(userInput);
```

## See also

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — `createPerAddressTreeKey` used internally for each child
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — manage signing slot watermarks for each child address
- [`@totemsdk/statechain`](https://www.npmjs.com/package/@totemsdk/statechain) — transfer assets between addresses off-chain

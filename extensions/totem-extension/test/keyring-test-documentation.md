# Keyring Management Test Suite

| Property | Value |
|----------|-------|
| **Component** | Wallet Keyring (Account Management) |
| **Type** | Unit Test |
| **Framework** | Jest |

## Purpose

This test suite validates the Keyring class that manages cryptographic keys and accounts in the Totem wallet. It ensures that:

1. **Key Generation** creates valid WOTS key pairs from seed
2. **Account Derivation** follows BIP32/BIP44-like hierarchical paths
3. **Key Storage** securely stores encrypted keys
4. **Account Management** adds, removes, and lists accounts correctly
5. **Password Protection** encrypts keyring with user password
6. **Lock/Unlock** properly secures keys when wallet is locked

The Keyring is the core security component - it must protect private keys while providing convenient account access.

## Test Design

The test suite validates keyring functionality through comprehensive unit tests:

### Test Structure
```
Keyring Tests
├── Initialization
│   ├── Create from new mnemonic
│   ├── Create from existing mnemonic
│   └── Create from seed
├── Account Management
│   ├── Add account
│   ├── Remove account
│   ├── List accounts
│   └── Get account by address
├── Key Operations
│   ├── Get private key (when unlocked)
│   ├── Sign transaction
│   └── Export private key
├── Lock/Unlock
│   ├── Lock keyring
│   ├── Unlock with correct password
│   ├── Unlock fails with wrong password
│   └── Keys cleared when locked
└── Persistence
    ├── Serialize keyring
    ├── Deserialize keyring
    └── Encrypted storage
```

## Pass Requirements

For tests to pass:

1. **Keyring creation** must generate valid seed and root key
2. **Account derivation** must follow deterministic path (m/44'/0'/0'/0/n)
3. **Public/private keys** must be correctly paired
4. **Encryption** must use password-based key derivation (PBKDF2/scrypt)
5. **Locked keyring** must not expose private keys
6. **Unlocked keyring** must provide key access
7. **Persistence** must maintain all accounts across save/load

## Test Coverage

### Initialization Tests
```typescript
✓ create keyring from new mnemonic
✓ create keyring from existing mnemonic
✓ create keyring from seed
✓ mnemonic has correct word count (12 or 24)
✓ seed is 32 or 64 bytes
```

### Account Management Tests
```typescript
✓ add account increments index
✓ derived accounts are deterministic
✓ account has address, publicKey
✓ remove account by index
✓ list all accounts
✓ get account by address
```

### Key Operations Tests
```typescript
✓ get private key when unlocked
✓ private key undefined when locked
✓ sign transaction with account key
✓ export private key (with password)
```

### Lock/Unlock Tests
```typescript
✓ lock() clears private keys from memory
✓ isLocked() returns true after lock
✓ unlock(correctPassword) succeeds
✓ unlock(wrongPassword) throws error
✓ unlock() restores private keys
```

### Encryption Tests
```typescript
✓ encrypted keyring not human-readable
✓ encrypted keyring different each time (salt)
✓ decrypt with correct password
✓ decrypt fails with wrong password
```

### Persistence Tests
```typescript
✓ serialize keyring to JSON
✓ deserialize restores all accounts
✓ serialized keyring is encrypted
✓ save and load round-trip
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework

### Dependencies
- BIP39 library for mnemonic generation
- WOTS key generation library
- Crypto library for encryption (Node.js crypto or WebCrypto)
- Buffer support

### Test Data
```javascript
const TEST_MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TEST_PASSWORD = "secure_password_123";
```

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test test/keyring.test.ts
```

### Run with coverage:
```bash
cd packages/totem-extension
npm test -- --coverage test/keyring.test.ts
```

### Run specific test group:
```bash
cd packages/totem-extension
npm test -- --testNamePattern="Lock/Unlock" test/keyring.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  test/keyring.test.ts
  Keyring
    Initialization
      ✓ create from new mnemonic (45ms)
      ✓ create from existing mnemonic (32ms)
      ✓ create from seed (28ms)
    Account Management
      ✓ add account (23ms)
      ✓ remove account (12ms)
      ✓ list accounts (8ms)
      ✓ get by address (10ms)
    Key Operations
      ✓ get private key when unlocked (15ms)
      ✓ sign transaction (234ms)
      ✓ export private key (56ms)
    Lock/Unlock
      ✓ lock clears keys (5ms)
      ✓ unlock with correct password (67ms)
      ✓ unlock fails with wrong password (45ms)
    Encryption
      ✓ encrypted not readable (12ms)
      ✓ decrypt with password (48ms)
    Persistence
      ✓ serialize to JSON (8ms)
      ✓ deserialize restores accounts (15ms)

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

### What Passing Tests Indicate
- ✅ Keyring securely manages keys
- ✅ Account derivation correct
- ✅ Encryption properly implemented
- ✅ Lock/unlock functional
- ✅ Persistence working

## Common Issues

### Issue: "unlock fails with wrong password" doesn't throw
**Cause**: No password verification  
**Solution**: Implement password check:
```typescript
unlock(password: string) {
  try {
    const decrypted = this.decrypt(this.encryptedData, password);
    this.keys = decrypted;
  } catch (err) {
    throw new Error('Incorrect password');
  }
}
```

### Issue: "lock clears keys" fails - keys still accessible
**Cause**: Keys not removed from memory  
**Solution**: Properly clear sensitive data:
```typescript
lock() {
  // Clear all private keys
  this.privateKeys = new Map();
  
  // Optionally overwrite memory
  Object.keys(this).forEach(key => {
    if (key.includes('private') || key.includes('secret')) {
      this[key] = null;
    }
  });
  
  this.locked = true;
}
```

### Issue: "derived accounts are deterministic" fails
**Cause**: Using random values instead of deterministic derivation  
**Solution**: Implement BIP32-style derivation:
```typescript
deriveAccount(index: number): Account {
  const path = `m/44'/0'/0'/0/${index}`;
  const derived = derivePath(this.masterSeed, path);
  
  return {
    index,
    publicKey: derived.publicKey,
    privateKey: derived.privateKey,
    address: derived.address
  };
}
```

### Issue: Encryption doesn't use salt (same ciphertext each time)
**Cause**: Missing random salt  
**Solution**: Add salt to encryption:
```typescript
function encrypt(data: Buffer, password: string): Buffer {
  const salt = randomBytes(32);
  const key = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  
  // Combine salt + iv + encrypted
  return Buffer.concat([salt, iv, encrypted]);
}
```

### Debugging Tips

1. **Log keyring state**:
```typescript
test('add account', () => {
  const keyring = new Keyring(mnemonic, password);
  console.log('Initial accounts:', keyring.accounts.length);
  
  keyring.addAccount();
  console.log('After add:', keyring.accounts.length);
  console.log('Account:', keyring.accounts[0]);
});
```

2. **Verify encryption**:
```typescript
const encrypted = keyring.encrypt();
console.log('Encrypted length:', encrypted.length);
console.log('Contains private key text:', encrypted.includes('private')); // Should be false
```

3. **Test derivation paths**:
```typescript
const accounts = [];
for (let i = 0; i < 5; i++) {
  const account = keyring.deriveAccount(i);
  accounts.push(account);
  console.log(`Account ${i}:`, account.address);
}

// Recreate keyring from same mnemonic
const keyring2 = new Keyring(sameMnemonic, password);
for (let i = 0; i < 5; i++) {
  const account2 = keyring2.deriveAccount(i);
  console.log(`Match ${i}:`, account2.address === accounts[i].address);
}
```

4. **Check password verification**:
```typescript
try {
  keyring.unlock('wrong_password');
  console.log('ERROR: Should have thrown');
} catch (err) {
  console.log('Correctly rejected:', err.message);
}
```

---

**Last Updated**: October 28, 2025

import { MinimaKeyring } from '../src/keyring';
import './setup';

describe('MinimaKeyring', () => {
  let keyring: MinimaKeyring;

  beforeEach(() => {
    keyring = new MinimaKeyring();
    jest.clearAllMocks();
  });

  describe('Vault Management', () => {
    test('can create a new vault', async () => {
      // Mock crypto operations
      const mockKey = { type: 'secret' } as CryptoKey;
      (crypto.subtle.importKey as jest.Mock).mockResolvedValue(mockKey);
      (crypto.subtle.deriveKey as jest.Mock).mockResolvedValue(mockKey);
      (crypto.subtle.encrypt as jest.Mock).mockResolvedValue(new ArrayBuffer(32));

      await keyring.createVault('testpassword123');
      
      expect(keyring.getRootPublicKey()).toMatch(/^0x[0-9a-f]+$/i);
    });

    test('throws error when accessing locked vault', () => {
      expect(() => keyring.getRootPublicKey()).toThrow('Vault is locked');
    });

    test('can check vault existence', async () => {
      const hasVault = await keyring.hasVault();
      expect(typeof hasVault).toBe('boolean');
    });
  });

  describe('Leaf Reservation', () => {
    beforeEach(async () => {
      // Mock crypto operations for vault creation
      const mockKey = { type: 'secret' } as CryptoKey;
      (crypto.subtle.importKey as jest.Mock).mockResolvedValue(mockKey);
      (crypto.subtle.deriveKey as jest.Mock).mockResolvedValue(mockKey);
      (crypto.subtle.encrypt as jest.Mock).mockResolvedValue(new ArrayBuffer(32));
      
      await keyring.createVault('testpassword123');
    });

    test('can reserve a leaf', async () => {
      const reservation = await keyring.reserveLeaf();
      
      expect(reservation.leaseId).toBeDefined();
      expect(typeof reservation.i1).toBe('number');
      expect(typeof reservation.i2).toBe('number');
      expect(typeof reservation.i3).toBe('number');
      expect(reservation.leafSeed).toBeInstanceOf(Uint8Array);
      expect(reservation.leafSeed.length).toBe(32);
    });

    test('can release a committed leaf', async () => {
      const reservation = await keyring.reserveLeaf();
      
      await expect(keyring.releaseLeaf(reservation.leaseId, true)).resolves.not.toThrow();
    });

    test('can release a rolled-back leaf', async () => {
      const reservation = await keyring.reserveLeaf();
      
      await expect(keyring.releaseLeaf(reservation.leaseId, false)).resolves.not.toThrow();
    });

    test('throws error for invalid lease ID', async () => {
      await expect(keyring.releaseLeaf('invalid-lease', true))
        .rejects.toThrow('Invalid lease ID');
    });

    test('can extend lease', async () => {
      const reservation = await keyring.reserveLeaf();
      
      const result = keyring.extendLease(reservation.leaseId, 10000);
      expect(result).toBe(true);
    });
  });

  describe('Signing Operations', () => {
    beforeEach(async () => {
      // Mock crypto operations for vault creation
      const mockKey = { type: 'secret' } as CryptoKey;
      (crypto.subtle.importKey as jest.Mock).mockResolvedValue(mockKey);
      (crypto.subtle.deriveKey as jest.Mock).mockResolvedValue(mockKey);
      (crypto.subtle.encrypt as jest.Mock).mockResolvedValue(new ArrayBuffer(32));
      
      await keyring.createVault('testpassword123');
    });

    test('can sign parent-child relationship', () => {
      const parentSeed = new Uint8Array(32).fill(1);
      const childRoot = new Uint8Array(32).fill(2);
      
      const signature = keyring.signParentChild(parentSeed, childRoot);
      
      expect(Array.isArray(signature)).toBe(true);
      expect(signature.length).toBe(34); // WOTS+ signature length
    });

    test('can sign transaction hash', () => {
      const txHash = new Uint8Array(32).fill(3);
      const leafSeed = new Uint8Array(32).fill(4);
      
      const signature = keyring.signTxHash(txHash, leafSeed);
      
      expect(Array.isArray(signature)).toBe(true);
      expect(signature.length).toBe(34); // WOTS+ signature length
    });

    test('throws error when signing with locked vault', () => {
      keyring.lock();
      
      const parentSeed = new Uint8Array(32).fill(1);
      const childRoot = new Uint8Array(32).fill(2);
      
      expect(() => keyring.signParentChild(parentSeed, childRoot))
        .toThrow('Vault is locked');
    });
  });

  describe('Usage Statistics', () => {
    beforeEach(async () => {
      // Mock crypto operations for vault creation
      const mockKey = { type: 'secret' } as CryptoKey;
      (crypto.subtle.importKey as jest.Mock).mockResolvedValue(mockKey);
      (crypto.subtle.deriveKey as jest.Mock).mockResolvedValue(mockKey);
      (crypto.subtle.encrypt as jest.Mock).mockResolvedValue(new ArrayBuffer(32));
      
      await keyring.createVault('testpassword123');
    });

    test('returns usage stats when unlocked', () => {
      const stats = keyring.getUsageStats();
      
      expect(stats).not.toBeNull();
      expect(typeof stats!.uses).toBe('number');
      expect(typeof stats!.maxUses).toBe('number');
      expect(typeof stats!.percentUsed).toBe('number');
      expect(stats!.uses).toBeGreaterThanOrEqual(0);
      expect(stats!.maxUses).toBeGreaterThan(0);
    });

    test('returns null when locked', () => {
      keyring.lock();
      
      const stats = keyring.getUsageStats();
      expect(stats).toBeNull();
    });
  });

  describe('Lock/Unlock Behavior', () => {
    test('vault starts locked', () => {
      expect(() => keyring.getRootPublicKey()).toThrow('Vault is locked');
    });

    test('locking clears internal state', async () => {
      // Mock crypto operations for vault creation
      const mockKey = { type: 'secret' } as CryptoKey;
      (crypto.subtle.importKey as jest.Mock).mockResolvedValue(mockKey);
      (crypto.subtle.deriveKey as jest.Mock).mockResolvedValue(mockKey);
      (crypto.subtle.encrypt as jest.Mock).mockResolvedValue(new ArrayBuffer(32));
      
      await keyring.createVault('testpassword123');
      expect(() => keyring.getRootPublicKey()).not.toThrow();
      
      keyring.lock();
      expect(() => keyring.getRootPublicKey()).toThrow('Vault is locked');
    });
  });
});
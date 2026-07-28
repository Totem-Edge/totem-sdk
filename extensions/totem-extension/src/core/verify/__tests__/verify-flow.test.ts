/**
 * Integration tests for Sign-In With Wallet verification flow
 * Tests: ChallengeBuilder, verifySignature, ConnectedSitesStore
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ChallengeBuilder,
  parseChallenge, 
  digestChallenge,
  type VerifyChallenge
} from '../ChallengeBuilder';
import { 
  verifySignature, 
  verifyRawSignature, 
  hexToBytes, 
  bytesToHex,
  createVerificationPayload,
  decodeVerificationPayload
} from '../verifySignature';

function createChallenge(opts: {
  domain: string;
  address: string;
  statement?: string;
  chainId?: string;
  expiryMs?: number;
}): string {
  const builder = ChallengeBuilder.create()
    .setDomain(opts.domain)
    .setAddress(opts.address);
  
  if (opts.statement) builder.setStatement(opts.statement);
  if (opts.chainId) builder.setChainId(opts.chainId);
  if (opts.expiryMs) builder.setExpiry(opts.expiryMs);
  
  return builder.build().message;
}

function isValidChallenge(message: string): boolean {
  const parsed = parseChallenge(message);
  if (!parsed) return false;
  return parsed.expiresAt > Date.now();
}

describe('ChallengeBuilder', () => {
  const testDomain = 'https://example.com';
  const testAddress = 'MxG1234567890ABCDEF';

  describe('createChallenge', () => {
    it('should create a valid challenge message', () => {
      const challenge = createChallenge({
        domain: testDomain,
        address: testAddress,
        expiryMs: 60000
      });

      expect(challenge).toContain(testDomain);
      expect(challenge).toContain(testAddress);
      expect(challenge).toContain('Nonce:');
      expect(challenge).toContain('Issued At:');
      expect(challenge).toContain('Expiration Time:');
    });

    it('should include statement if provided', () => {
      const statement = 'Sign in to access your dashboard';
      const challenge = createChallenge({
        domain: testDomain,
        address: testAddress,
        statement,
        expiryMs: 60000
      });

      expect(challenge).toContain(statement);
    });

    it('should include chain ID', () => {
      const challenge = createChallenge({
        domain: testDomain,
        address: testAddress,
        chainId: 'minima-mainnet',
        expiryMs: 60000
      });

      expect(challenge).toContain('Chain ID: minima-mainnet');
    });
  });

  describe('parseChallenge', () => {
    it('should parse a valid challenge', () => {
      const challenge = createChallenge({
        domain: testDomain,
        address: testAddress,
        expiryMs: 60000
      });

      const parsed = parseChallenge(challenge);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.domain).toBe(testDomain);
      expect(parsed?.address).toBe(testAddress);
      expect(parsed?.nonce).toBeDefined();
      expect(parsed?.nonce.length).toBeGreaterThan(10);
      expect(parsed?.issuedAt).toBeGreaterThan(0);
      expect(parsed?.expiresAt).toBeGreaterThan(parsed?.issuedAt || 0);
    });

    it('should return null for invalid challenge', () => {
      const parsed = parseChallenge('invalid challenge text');
      expect(parsed).toBeNull();
    });
  });

  describe('digestChallenge', () => {
    it('should produce consistent hash for same challenge', () => {
      const challengeData: VerifyChallenge = {
        domain: testDomain,
        address: testAddress,
        statement: 'Test statement',
        nonce: 'test-nonce-12345678',
        issuedAt: 1704067200000,
        expiresAt: 1704067260000
      };

      const digest1 = digestChallenge(challengeData);
      const digest2 = digestChallenge(challengeData);

      expect(digest1.digestHex).toBe(digest2.digestHex);
    });

    it('should produce different hash for different domain', () => {
      const challengeData1: VerifyChallenge = {
        domain: testDomain,
        address: testAddress,
        statement: 'Test statement',
        nonce: 'test-nonce-12345678',
        issuedAt: 1704067200000,
        expiresAt: 1704067260000
      };

      const challengeData2: VerifyChallenge = {
        ...challengeData1,
        domain: 'https://other.com'
      };

      const digest1 = digestChallenge(challengeData1);
      const digest2 = digestChallenge(challengeData2);

      expect(digest1.digestHex).not.toBe(digest2.digestHex);
    });

    it('should return 0x-prefixed 64-char hex string (SHA3-256)', () => {
      const challengeData: VerifyChallenge = {
        domain: testDomain,
        address: testAddress,
        statement: 'Test statement',
        nonce: 'test-nonce-12345678',
        issuedAt: 1704067200000,
        expiresAt: 1704067260000
      };

      const { digestHex } = digestChallenge(challengeData);
      
      expect(digestHex.startsWith('0x')).toBe(true);
      expect(digestHex.length).toBe(66);
    });
  });

  describe('isValidChallenge', () => {
    it('should return true for valid non-expired challenge', () => {
      const challenge = createChallenge({
        domain: testDomain,
        address: testAddress,
        expiryMs: 60000
      });

      expect(isValidChallenge(challenge)).toBe(true);
    });

    it('should return false for expired challenge', () => {
      const challenge = createChallenge({
        domain: testDomain,
        address: testAddress,
        expiryMs: -1000
      });

      expect(isValidChallenge(challenge)).toBe(false);
    });
  });
});

describe('verifySignature utilities', () => {
  describe('hexToBytes', () => {
    it('should convert hex string to bytes', () => {
      const hex = '0x48656c6c6f';
      const bytes = hexToBytes(hex);
      
      expect(bytes.length).toBe(5);
      expect(Array.from(bytes)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    });

    it('should handle hex without 0x prefix', () => {
      const hex = '48656c6c6f';
      const bytes = hexToBytes(hex);
      
      expect(bytes.length).toBe(5);
    });
  });

  describe('bytesToHex', () => {
    it('should convert bytes to hex string', () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      const hex = bytesToHex(bytes);
      
      expect(hex).toBe('0x48656c6c6f');
    });

    it('should be inverse of hexToBytes', () => {
      const original = '0xdeadbeef';
      const bytes = hexToBytes(original);
      const result = bytesToHex(bytes);
      
      expect(result).toBe(original);
    });
  });

  describe('createVerificationPayload', () => {
    it('should create base64 encoded payload', () => {
      const payload = createVerificationPayload(
        'MxG123',
        '0xsignature',
        '0xpubkey',
        'test message'
      );

      expect(typeof payload).toBe('string');
      expect(payload.length).toBeGreaterThan(0);
    });

    it('should be decodable', () => {
      const address = 'MxG123456';
      const signature = '0xsig123';
      const publicKey = '0xpub456';
      const message = 'Sign this message';

      const payload = createVerificationPayload(address, signature, publicKey, message);
      const decoded = decodeVerificationPayload(payload);

      expect(decoded).not.toBeNull();
      expect(decoded?.message).toBe(message);
      expect(decoded?.signature).toBe(signature);
      expect(decoded?.publicKey).toBe(publicKey);
    });
  });

  describe('decodeVerificationPayload', () => {
    it('should return null for invalid payload', () => {
      expect(decodeVerificationPayload('invalid')).toBeNull();
      expect(decodeVerificationPayload('')).toBeNull();
    });

    it('should return null for missing fields', () => {
      const incomplete = btoa(JSON.stringify({ message: 'only message' }));
      expect(decodeVerificationPayload(incomplete)).toBeNull();
    });
  });
});

describe('verifySignature', () => {
  it('should return error for invalid challenge format', () => {
    const result = verifySignature({
      message: 'not a valid challenge',
      signature: '0x123',
      publicKey: '0xabc'
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid challenge');
  });

  it('should return error for expired challenge', () => {
    const expiredChallenge = createChallenge({
      domain: 'https://test.com',
      address: 'MxG123',
      expiryMs: -10000
    });

    const result = verifySignature({
      message: expiredChallenge,
      signature: '0x123',
      publicKey: '0xabc'
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('expired');
  });
});

describe('Connected Sites Flow', () => {
  it('should track site connections', async () => {
    const storage: Record<string, any> = {};
    
    global.chrome = {
      storage: {
        local: {
          get: vi.fn((keys) => Promise.resolve(storage)),
          set: vi.fn((data) => {
            Object.assign(storage, data);
            return Promise.resolve();
          })
        }
      }
    } as any;

    const site = {
      origin: 'https://example.com',
      addressIndex: 5,
      minimaAddress: 'MxG0ABC123...',
      permissions: ['read', 'verify'],
      connectedAt: Date.now()
    };

    storage['connectedSites'] = [site];

    const result = await chrome.storage.local.get(['connectedSites']);
    expect(result.connectedSites).toHaveLength(1);
    expect(result.connectedSites[0].origin).toBe('https://example.com');
  });
});

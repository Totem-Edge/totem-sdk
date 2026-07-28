/**
 * Unit Tests for Script Types and Helpers
 */

import {
  createSignedByDescriptor,
  createMultisigDescriptor,
  createMofNMultisigDescriptor,
  createTimelockDescriptor,
  createHTLCDescriptor,
  createMASTDescriptor,
  createExchangeDescriptor,
  createFlashCashDescriptor,
  createSlowCashDescriptor,
  createEmptyMMRProof
} from '../types/ScriptTypes';
import {
  TimelockHelper,
  HTLCHelper,
  MASTHelper,
  ExchangeHelper,
  VaultHelper,
  FlashCashHelper,
  SlowCashHelper,
  StatefulGameHelper
} from '../helpers/ContractHelpers';

describe('ScriptTypes', () => {
  const testPublicKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const testAddress = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  
  describe('createSignedByDescriptor', () => {
    it('should create a simple SIGNEDBY descriptor', () => {
      const desc = createSignedByDescriptor(testAddress, testPublicKey);
      
      expect(desc.scriptType).toBe('signedby');
      expect(desc.script).toContain('RETURN SIGNEDBY(');
      expect(desc.script).toContain(testPublicKey.toUpperCase().replace('0X', '0x'));
      expect(desc.wotsRootPublicKey).toBe(testPublicKey);
      expect(desc.mastProof?.chunks).toHaveLength(0);
    });
  });
  
  describe('createMultisigDescriptor', () => {
    const pk1 = '0x1111111111111111111111111111111111111111111111111111111111111111';
    const pk2 = '0x2222222222222222222222222222222222222222222222222222222222222222';
    
    it('should create a 2-of-2 multisig descriptor', () => {
      const desc = createMultisigDescriptor(testAddress, pk1, pk2, pk1);
      
      expect(desc.scriptType).toBe('multisig');
      expect(desc.script).toContain('SIGNEDBY(');
      expect(desc.script).toContain('AND');
      expect(desc.multisigKeys).toEqual([pk1, pk2]);
      expect(desc.multisigThreshold).toBe(2);
    });
  });
  
  describe('createMofNMultisigDescriptor', () => {
    const keys = [
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333333333333333333333333333'
    ];
    
    it('should create a 2-of-3 multisig descriptor', () => {
      const desc = createMofNMultisigDescriptor(testAddress, 2, keys, keys[0]);
      
      expect(desc.scriptType).toBe('multisig_mofn');
      expect(desc.script).toContain('MULTISIG(2');
      expect(desc.multisigKeys).toEqual(keys);
      expect(desc.multisigThreshold).toBe(2);
    });
  });
  
  describe('createTimelockDescriptor', () => {
    it('should create a timelock descriptor', () => {
      const unlockBlock = 1000n;
      const desc = createTimelockDescriptor(testAddress, testPublicKey, unlockBlock);
      
      expect(desc.scriptType).toBe('timelock');
      expect(desc.script).toContain('@BLOCK GT');
      expect(desc.script).toContain('1000');
      expect(desc.timelockBlock).toBe(unlockBlock);
    });
  });
  
  describe('createHTLCDescriptor', () => {
    const senderPk = '0x1111111111111111111111111111111111111111111111111111111111111111';
    const recipientPk = '0x2222222222222222222222222222222222222222222222222222222222222222';
    const hashLock = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    
    it('should create an HTLC descriptor for claiming', () => {
      const desc = createHTLCDescriptor(
        testAddress,
        senderPk,
        recipientPk,
        hashLock,
        1000n,
        false,
        'secret123'
      );
      
      expect(desc.scriptType).toBe('htlc');
      expect(desc.script).toContain('SHA3(STATE(1))');
      expect(desc.htlcHash).toBe(hashLock);
      expect(desc.htlcPreimage).toBe('secret123');
      expect(desc.stateVariables).toHaveLength(1);
      expect(desc.stateVariables?.[0].port).toBe(1);
    });
    
    it('should create an HTLC descriptor for refund', () => {
      const desc = createHTLCDescriptor(
        testAddress,
        senderPk,
        recipientPk,
        hashLock,
        1000n,
        true
      );
      
      expect(desc.scriptType).toBe('htlc');
      expect(desc.wotsRootPublicKey).toBe(senderPk);
      expect(desc.htlcPreimage).toBeUndefined();
    });
  });
  
  describe('createEmptyMMRProof', () => {
    it('should create an empty proof with SDK format', () => {
      const proof = createEmptyMMRProof();
      
      expect(proof.chunks).toHaveLength(0);
    });
  });
});

describe('ContractHelpers', () => {
  describe('TimelockHelper', () => {
    const testPk = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    
    it('should create block timelock script', () => {
      const result = TimelockHelper.createBlockTimelock(testPk, 1000n);
      
      expect(result.script).toContain('@BLOCK GT 1000');
      expect(result.script).toContain('SIGNEDBY(');
      expect(result.address).toMatch(/^0x[0-9a-f]{64}$/);
    });
    
    it('should create coinage timelock script', () => {
      const result = TimelockHelper.createCoinageTimelock(testPk, 500n);
      
      expect(result.script).toContain('@COINAGE GT 500');
    });
    
    it('should check if timelock is unlocked', () => {
      expect(TimelockHelper.isUnlocked(100n, 101n)).toBe(true);
      expect(TimelockHelper.isUnlocked(100n, 100n)).toBe(false);
      expect(TimelockHelper.isUnlocked(100n, 99n)).toBe(false);
    });
  });
  
  describe('HTLCHelper', () => {
    it('should generate secret and hash', () => {
      const { preimage, hash } = HTLCHelper.generateSecret();
      
      expect(preimage).toMatch(/^0x[0-9a-f]{64}$/);
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(preimage).not.toBe(hash);
    });
    
    it('should verify preimage with SHA3', () => {
      const { preimage, hash } = HTLCHelper.generateSecret();
      
      expect(HTLCHelper.verifyPreimage(preimage, hash, 'sha3')).toBe(true);
      expect(HTLCHelper.verifyPreimage('0x0000000000000000000000000000000000000000000000000000000000000000', hash, 'sha3')).toBe(false);
    });
    
    it('should create HTLC script', () => {
      const senderPk = '0x1111111111111111111111111111111111111111111111111111111111111111';
      const recipientPk = '0x2222222222222222222222222222222222222222222222222222222222222222';
      const { hash } = HTLCHelper.generateSecret();
      
      const result = HTLCHelper.createHTLC(senderPk, recipientPk, hash, 1000n, 'sha3');
      
      expect(result.script).toContain('@BLOCK GT 1000');
      expect(result.script).toContain('SHA3(STATE(1))');
      expect(result.address).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });
  
  describe('MASTHelper', () => {
    it('should hash script consistently', () => {
      const script = 'RETURN TRUE';
      const hash1 = MASTHelper.hashScript(script);
      const hash2 = MASTHelper.hashScript(script);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[0-9a-f]{64}$/);
    });
    
    it('should build simple tree from 2 scripts', () => {
      const scripts = ['RETURN TRUE', 'RETURN FALSE'];
      const result = MASTHelper.buildSimpleTree(scripts);
      
      expect(result.root).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result.proofs.size).toBe(2);
      expect(result.proofs.has('RETURN TRUE')).toBe(true);
      expect(result.proofs.has('RETURN FALSE')).toBe(true);
    });
    
    it('should create MAST script', () => {
      const rootHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const result = MASTHelper.createMASTScript(rootHash);
      
      expect(result.script).toContain('MAST');
      expect(result.script).toContain(rootHash.toUpperCase().replace('0X', '0x'));
    });
  });
  
  describe('ExchangeHelper', () => {
    it('should create exchange offer', () => {
      const result = ExchangeHelper.createOffer(
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222222222222222222222222222',
        '100',
        '0x00'
      );
      
      expect(result.script).toContain('VERIFYOUT');
      expect(result.script).toContain('PREVSTATE');
    });
    
    it('should build offer state', () => {
      const state = ExchangeHelper.buildOfferState(
        '0xowner',
        '0xrecipient',
        '100',
        '0x00'
      );
      
      expect(state).toHaveLength(4);
      expect(state[0].port).toBe(0);
      expect(state[1].port).toBe(1);
      expect(state[2].port).toBe(2);
      expect(state[3].port).toBe(3);
    });
    
    it('should validate exchange', () => {
      const outputs = [
        { address: '0xrecipient', amount: '100', tokenId: '0x00' }
      ];
      
      const valid = ExchangeHelper.validateExchange(
        outputs, '0xrecipient', '100', '0x00', 0
      );
      expect(valid.valid).toBe(true);
      
      const invalid = ExchangeHelper.validateExchange(
        outputs, '0xwrong', '100', '0x00', 0
      );
      expect(invalid.valid).toBe(false);
    });
  });
  
  describe('VaultHelper', () => {
    const coldKey = '0x1111111111111111111111111111111111111111111111111111111111111111';
    const hotKey = '0x2222222222222222222222222222222222222222222222222222222222222222';
    
    it('should generate safe house script', () => {
      const script = VaultHelper.generateSafeHouseScript(coldKey, hotKey, 20n);
      
      expect(script).toContain('pkcold');
      expect(script).toContain('pkhot');
      expect(script).toContain('@COINAGE GT 20');
      expect(script).toContain('VERIFYOUT');
    });
    
    it('should create vault with safe house', () => {
      const result = VaultHelper.createVault(coldKey, hotKey, 20n);
      
      expect(result.vaultScript).toContain('safehouse');
      expect(result.vaultAddress).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result.safeHouseAddress).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });
  
  describe('FlashCashHelper', () => {
    it('should create flash cash contract', () => {
      const result = FlashCashHelper.createFlashCash(
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '1.01'
      );
      
      expect(result.script).toContain('@AMOUNT*1.01');
      expect(result.script).toContain('SAMESTATE');
    });
    
    it('should calculate return amount', () => {
      const returnAmount = FlashCashHelper.calculateReturn(1000n, 1.01);
      
      expect(returnAmount).toBe(1010n);
    });
  });
  
  describe('SlowCashHelper', () => {
    it('should create slow cash contract', () => {
      const result = SlowCashHelper.createSlowCash(
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0.9',
        10000n
      );
      
      expect(result.script).toContain('@COINAGE LT 10000');
      expect(result.script).toContain('@AMOUNT*0.9');
    });
    
    it('should calculate withdrawal', () => {
      const { withdrawal, remaining } = SlowCashHelper.calculateWithdrawal(1000n, 0.9);
      
      expect(remaining).toBe(900n);
      expect(withdrawal).toBe(100n);
    });
    
    it('should check if withdrawal is allowed', () => {
      expect(SlowCashHelper.canWithdraw(10001n, 10000n)).toBe(true);
      expect(SlowCashHelper.canWithdraw(9999n, 10000n)).toBe(false);
    });
  });
  
  describe('StatefulGameHelper', () => {
    it('should create round check', () => {
      const check = StatefulGameHelper.createRoundCheck();
      
      expect(check).toContain('STATE(0)');
      expect(check).toContain('PREVSTATE(0)');
      expect(check).toContain('INC(prevround)');
    });
    
    it('should build next round state', () => {
      const state = StatefulGameHelper.buildNextRoundState(
        1,
        [1, 2, 3],
        [{ port: 4, value: 'test', type: 'string' }]
      );
      
      expect(state[0].port).toBe(0);
      expect(state[0].value).toBe(2n);
    });
    
    it('should validate round progression', () => {
      expect(StatefulGameHelper.validateRound(1, 2)).toBe(true);
      expect(StatefulGameHelper.validateRound(1, 3)).toBe(false);
      expect(StatefulGameHelper.validateRound(1, 1)).toBe(false);
    });
  });
});

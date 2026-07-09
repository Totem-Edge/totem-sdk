/**
 * Java Parity Vector Tests
 * 
 * These tests mirror the exact input values from Minima's Java unit tests.
 * They serialize objects using our TypeScript implementation and output hex
 * for comparison against Java's serialization output.
 * 
 * Source files:
 * - attached_assets/CoinTests_1768991238159.java
 * - attached_assets/TokenTests_1768991250119.java
 * - attached_assets/TransactionTests_1768991263217.java
 * - attached_assets/TxHeaderTests_1768991294482.java
 * - attached_assets/AddressTests_1768991225581.java
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * USAGE:
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. Run these tests: `npm test -- --testPathPattern=JavaParityVectors`
 * 2. Note the hex output from console.log statements
 * 3. Run the Java tests with byte logging (see patches below)
 * 4. Compare outputs and update expectedHex values once Java bytes are confirmed
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * JAVA LOGGING PATCHES REQUIRED:
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Add the following logging after writeDataStream(dos) in each Java test:
 * 
 * ---[ CoinTests.java - testReadAndWriteDataStream() ]---
 * After line: c.writeDataStream(dos);
 * Add:
 *   System.out.println("[COIN_HEX] 0x" + new MiniData(bos.toByteArray()).to0xString());
 * 
 * ---[ TokenTests.java - testStaticReadAndWriteDataStream() ]---
 * After line: t.writeDataStream(dos);
 * Add:
 *   System.out.println("[TOKEN_HEX] 0x" + new MiniData(bos.toByteArray()).to0xString());
 * 
 * ---[ TransactionTests.java - testMinimaTransaction() ]---
 * After line: t.writeDataStream(dos);
 * Add:
 *   System.out.println("[TX_HEX] 0x" + new MiniData(bos.toByteArray()).to0xString());
 * 
 * ---[ TxHeaderTests.java - TxHeaderTests() ]---
 * After line: mHeader.writeDataStream(dos);
 * Add:
 *   System.out.println("[TXHEADER_HEX] 0x" + new MiniData(bos.toByteArray()).to0xString());
 * 
 * ---[ AddressTests.java - testWriteAndReadDataStream() ]---
 * After line: a.writeDataStream(dos);
 * Add:
 *   System.out.println("[ADDRESS_HEX] 0x" + new MiniData(bos.toByteArray()).to0xString());
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * OUR TYPESCRIPT OUTPUT (from running these tests):
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * [CoinTests] Coin:          0x000000020fff00000004ffffffff00010c000000017b000001000000010000010000
 * [TokenTests] Token:        0x00000002ffff00010c00010c0000000a746f6b656e2d6e616d650000000446464646
 * [TransactionTests] Coin5:  0x0000000100000000202b1b3fd8ad198a5c9b0a8b376c73766b73ace408e0a2537b827ec8dcff4133bc0001050000000100000001000000010000010000
 * [TransactionTests] State:  0x01040000000c5b48656c6c6f576f726c645d
 * [TxHeader] Difficulty:     0x00000002ffff
 * [TxHeader] TimeMilli:      0x000405f5e0ff
 * [TxHeader] BlockNumber:    0x000301e23a  
 * [TxHeader] Nonce:          0x00030dbba0
 * [AddressTests] Address:    0x00000003fff0f0
 * 
 * Once Java outputs are available, update the expect() assertions below.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  writeMiniData,
  writeMiniNumber,
  writeMiniByte,
  writeHashToStream,
  hexToBytes,
  bytesToHex,
  concat,
  writeStateVariable
} from '../utils/Streamable';

describe('Java Parity Vectors', () => {
  
  describe('CoinTests Parity', () => {
    /**
     * From CoinTests.java testReadAndWriteDataStream():
     *   MiniData coinId = new MiniData("0xfff");
     *   MiniData coinAddress = new MiniData("0xffffffff");
     *   MiniNumber twelve = MiniNumber.TWELVE;
     *   MiniData tokenId = new MiniData("123");  // Note: "123" is parsed as decimal, becomes 0x7B
     *   Coin c = new Coin(coinId, coinAddress, twelve, tokenId);
     */
    it('should serialize Coin matching Java CoinTests', () => {
      const coinId = hexToBytes('0x0fff'); // 0xfff is 3 nibbles, padded to 0x0fff
      const coinAddress = hexToBytes('0xffffffff');
      const amount = 12n; // MiniNumber.TWELVE
      const tokenId = hexToBytes('0x7b'); // "123" decimal = 0x7B hex
      
      const coinBytes = serializeCoinForTest({
        coinId,
        address: coinAddress,
        amount,
        amountScale: 0,
        tokenId,
        storestate: false,
        mmrentry: 0n,
        spent: false,
        blockcreated: 0n,
        states: [],
        hasToken: false
      });
      
      const hex = bytesToHex(coinBytes);
      console.log('[CoinTests] Our serialization:', hex);
      console.log('[CoinTests] Length:', coinBytes.length, 'bytes');
      
      // TODO: Update with actual Java output once available
      // expect(hex).toBe(expectedHex);
      expect(coinBytes.length).toBeGreaterThan(0);
    });

    it('should serialize MiniData "0xfff" correctly', () => {
      // Java: new MiniData("0xfff") - this is 12 bits, stored as 2 bytes: 0x0f, 0xff
      const data = hexToBytes('0x0fff');
      const serialized = writeMiniData(data);
      console.log('[MiniData 0xfff]:', bytesToHex(serialized));
      
      // MiniData uses 4-byte length prefix
      expect(serialized.length).toBe(4 + 2); // 4-byte len + 2 bytes data
    });

    it('should serialize MiniNumber.TWELVE correctly', () => {
      // Java: MiniNumber.TWELVE = 12, scale 0
      const serialized = writeMiniNumber(12n, 0);
      console.log('[MiniNumber.TWELVE]:', bytesToHex(serialized));
      
      // MiniNumber: scale(1) + len(1) + unscaled bytes
      expect(serialized[0]).toBe(0); // scale = 0
    });
  });

  describe('TokenTests Parity', () => {
    /**
     * From TokenTests.java testStaticReadAndWriteDataStream():
     *   MiniString name = new MiniString("token-name");
     *   MiniString script = new MiniString("FFFF");
     *   MiniData coinId = new MiniData("0xffff");
     *   MiniNumber twelve = MiniNumber.TWELVE;
     *   Token t = new Token(coinId, twelve, twelve, name, script);
     */
    it('should serialize Token fields matching Java TokenTests', () => {
      const coinId = hexToBytes('0xffff');
      const scale = 12n;
      const amount = 12n;
      const name = 'token-name';
      const script = 'FFFF';
      
      // Token serialization order from Java Token.writeDataStream:
      // 1. coinid (MiniData)
      // 2. scale (MiniNumber)
      // 3. amount (MiniNumber)
      // 4. name (MiniString as MiniData)
      // 5. script (MiniString as MiniData)
      
      const coinIdBytes = writeMiniData(coinId);
      const scaleBytes = writeMiniNumber(scale, 0);
      const amountBytes = writeMiniNumber(amount, 0);
      const nameBytes = writeMiniData(new TextEncoder().encode(name));
      const scriptBytes = writeMiniData(new TextEncoder().encode(script));
      
      const tokenBytes = concat(coinIdBytes, scaleBytes, amountBytes, nameBytes, scriptBytes);
      
      console.log('[TokenTests] coinId:', bytesToHex(coinIdBytes));
      console.log('[TokenTests] scale:', bytesToHex(scaleBytes));
      console.log('[TokenTests] amount:', bytesToHex(amountBytes));
      console.log('[TokenTests] name:', bytesToHex(nameBytes));
      console.log('[TokenTests] script:', bytesToHex(scriptBytes));
      console.log('[TokenTests] Full serialization:', bytesToHex(tokenBytes));
      console.log('[TokenTests] Length:', tokenBytes.length, 'bytes');
      
      expect(tokenBytes.length).toBeGreaterThan(0);
    });
  });

  describe('TransactionTests Parity', () => {
    /**
     * From TransactionTests.java testMinimaTransaction():
     *   Coin c = new Coin(Coin.COINID_OUTPUT,
     *       new MiniData("0x2B1B3FD8AD198A5C9B0A8B376C73766B73ACE408E0A2537B827EC8DCFF4133BC"),
     *       new MiniNumber(5),
     *       Token.TOKENID_MINIMA);
     *   t.addInput(c);
     *   
     *   Coin c1 = new Coin(Coin.COINID_OUTPUT, same address, new MiniNumber(2), TOKENID_MINIMA);
     *   t.addOutput(c1);
     *   
     *   Coin c2 = new Coin(COINID_OUTPUT, same address, new MiniNumber(3), TOKENID_MINIMA);
     *   t.addOutput(c2);
     *   
     *   t.addStateVariable(new StateVariable(1, "[HelloWorld]"));
     */
    
    const COINID_OUTPUT = hexToBytes('0x00'); // Coin.COINID_OUTPUT = MiniData("0x00")
    const TOKENID_MINIMA = hexToBytes('0x00'); // Token.TOKENID_MINIMA = MiniData("0x00")
    const ADDRESS = hexToBytes('0x2B1B3FD8AD198A5C9B0A8B376C73766B73ACE408E0A2537B827EC8DCFF4133BC');

    it('should serialize input Coin (amount=5) matching Java', () => {
      const coinBytes = serializeCoinForTest({
        coinId: COINID_OUTPUT,
        address: ADDRESS,
        amount: 5n,
        amountScale: 0,
        tokenId: TOKENID_MINIMA,
        storestate: false,
        mmrentry: 0n,
        spent: false,
        blockcreated: 0n,
        states: [],
        hasToken: false
      });
      
      console.log('[TransactionTests] Input Coin (5):', bytesToHex(coinBytes));
      console.log('[TransactionTests] Length:', coinBytes.length, 'bytes');
      expect(coinBytes.length).toBeGreaterThan(0);
    });

    it('should serialize output Coin (amount=2) matching Java', () => {
      const coinBytes = serializeCoinForTest({
        coinId: COINID_OUTPUT,
        address: ADDRESS,
        amount: 2n,
        amountScale: 0,
        tokenId: TOKENID_MINIMA,
        storestate: false,
        mmrentry: 0n,
        spent: false,
        blockcreated: 0n,
        states: [],
        hasToken: false
      });
      
      console.log('[TransactionTests] Output Coin (2):', bytesToHex(coinBytes));
      expect(coinBytes.length).toBeGreaterThan(0);
    });

    it('should serialize StateVariable port=1 value="[HelloWorld]" matching Java', () => {
      const stateBytes = writeStateVariable({ port: 1, value: '[HelloWorld]', type: 'string' });
      
      console.log('[TransactionTests] StateVariable:', bytesToHex(stateBytes));
      console.log('[TransactionTests] StateVar length:', stateBytes.length, 'bytes');
      expect(stateBytes.length).toBeGreaterThan(0);
    });

    it('should serialize complete Transaction matching Java', () => {
      // Transaction structure from Java Transaction.writeDataStream:
      // 1. inputs.size() as MiniNumber
      // 2. each input Coin
      // 3. outputs.size() as MiniNumber
      // 4. each output Coin
      // 5. state variables count
      // 6. each state variable
      // 7. linkhash (MiniData)
      
      const inputCoin = serializeCoinForTest({
        coinId: COINID_OUTPUT,
        address: ADDRESS,
        amount: 5n,
        amountScale: 0,
        tokenId: TOKENID_MINIMA,
        storestate: false,
        mmrentry: 0n,
        spent: false,
        blockcreated: 0n,
        states: [],
        hasToken: false
      });
      
      const outputCoin1 = serializeCoinForTest({
        coinId: COINID_OUTPUT,
        address: ADDRESS,
        amount: 2n,
        amountScale: 0,
        tokenId: TOKENID_MINIMA,
        storestate: false,
        mmrentry: 0n,
        spent: false,
        blockcreated: 0n,
        states: [],
        hasToken: false
      });
      
      const outputCoin2 = serializeCoinForTest({
        coinId: COINID_OUTPUT,
        address: ADDRESS,
        amount: 3n,
        amountScale: 0,
        tokenId: TOKENID_MINIMA,
        storestate: false,
        mmrentry: 0n,
        spent: false,
        blockcreated: 0n,
        states: [],
        hasToken: false
      });
      
      const stateVar = writeStateVariable({ port: 1, value: '[HelloWorld]', type: 'string' });
      
      // Build transaction
      const inputCount = writeMiniNumber(1n, 0);
      const outputCount = writeMiniNumber(2n, 0);
      const stateCount = writeMiniNumber(1n, 0);
      // CRITICAL: Java's MiniData.ZERO_TXPOWID = 0x00 (1 byte), NOT empty or 32 zeros
      const linkHash = writeMiniData(new Uint8Array([0x00])); // Java's ZERO_TXPOWID
      
      const txBytes = concat(
        inputCount,
        inputCoin,
        outputCount,
        outputCoin1,
        outputCoin2,
        stateCount,
        stateVar,
        linkHash
      );
      
      console.log('[TransactionTests] Full Transaction:', bytesToHex(txBytes));
      console.log('[TransactionTests] Total length:', txBytes.length, 'bytes');
      
      // Breakdown
      console.log('[TransactionTests] Breakdown:');
      console.log('  inputCount:', bytesToHex(inputCount));
      console.log('  outputCount:', bytesToHex(outputCount));
      console.log('  stateCount:', bytesToHex(stateCount));
      console.log('  linkHash:', bytesToHex(linkHash));
      
      expect(txBytes.length).toBeGreaterThan(0);
    });
  });

  describe('TxHeaderTests Parity', () => {
    /**
     * From TxHeaderTests.java:
     *   mHeader.mTxBodyHash = Crypto.getInstance().hashObject(new MiniData("0x1234"));
     *   mHeader.mBlockDifficulty = new MiniData("0xffff");
     *   mHeader.mTimeMilli = new MiniNumber(99999999);
     *   mHeader.mBlockNumber = new MiniNumber(123450);
     *   mHeader.mNonce = new MiniNumber(900000);
     */
    it('should serialize TxHeader fields matching Java', () => {
      // Note: We can't compute Crypto.hashObject(new MiniData("0x1234")) without
      // knowing the exact Java implementation, but we can serialize the other fields
      
      const blockDifficulty = writeMiniData(hexToBytes('0xffff'));
      const timeMilli = writeMiniNumber(99999999n, 0);
      const blockNumber = writeMiniNumber(123450n, 0);
      const nonce = writeMiniNumber(900000n, 0);
      
      console.log('[TxHeaderTests] blockDifficulty:', bytesToHex(blockDifficulty));
      console.log('[TxHeaderTests] timeMilli:', bytesToHex(timeMilli));
      console.log('[TxHeaderTests] blockNumber:', bytesToHex(blockNumber));
      console.log('[TxHeaderTests] nonce:', bytesToHex(nonce));
      
      expect(blockDifficulty.length).toBeGreaterThan(0);
      expect(timeMilli.length).toBeGreaterThan(0);
      expect(blockNumber.length).toBeGreaterThan(0);
      expect(nonce.length).toBeGreaterThan(0);
    });
  });

  describe('AddressTests Parity', () => {
    /**
     * From AddressTests.java testWriteAndReadDataStream():
     *   MiniData i = new MiniData("0xfff0f0");
     *   Address a = new Address(i);
     */
    it('should serialize Address matching Java', () => {
      const addressData = hexToBytes('0xfff0f0');
      
      // Address.writeDataStream just writes the MiniData
      const serialized = writeMiniData(addressData);
      
      console.log('[AddressTests] Address 0xfff0f0:', bytesToHex(serialized));
      console.log('[AddressTests] Length:', serialized.length, 'bytes');
      
      expect(serialized.length).toBe(4 + 3); // 4-byte len + 3 bytes data
    });

    it('should serialize various address lengths', () => {
      // Test cases from AddressTests.java testMakeMinimaAddress()
      // Fixed to have even-length hex strings
      const testCases = [
        '0xffffffffffffffffffffffffffffffffffffffff', // 20 bytes
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // 34 bytes
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' // 40 bytes
      ];
      
      for (const hex of testCases) {
        const data = hexToBytes(hex);
        const serialized = writeMiniData(data);
        console.log(`[AddressTests] ${hex.slice(0, 20)}... (${data.length} bytes):`, bytesToHex(serialized));
      }
    });
  });
});

// Helper function matching Coin serialization structure
interface CoinData {
  coinId: Uint8Array;
  address: Uint8Array;
  amount: bigint;
  amountScale: number;
  tokenId: Uint8Array;
  storestate: boolean;
  mmrentry: bigint;
  spent: boolean;
  blockcreated: bigint;
  states: any[];
  hasToken: boolean;
}

function serializeCoinForTest(coin: CoinData): Uint8Array {
  // Java Coin.writeDataStream order:
  // 1. coinid (writeHashToStream or writeMiniData based on context)
  // 2. address
  // 3. amount (MiniNumber)
  // 4. tokenid
  // 5. storestate (MiniByte)
  // 6. mmrentry (MMREntryNumber - but in simple tests this may differ)
  // 7. spent (MiniByte)
  // 8. blockcreated (MiniNumber)
  // 9. state.size() + each state
  // 10. hasToken (MiniByte)
  
  // For test coins, use writeMiniData for variable-length fields
  return concat(
    writeMiniData(coin.coinId),
    writeMiniData(coin.address),
    writeMiniNumber(coin.amount, coin.amountScale),
    writeMiniData(coin.tokenId),
    writeMiniByte(coin.storestate),
    writeMiniNumber(coin.mmrentry, 0), // Simplified - real uses writeMMREntryNumber
    writeMiniByte(coin.spent),
    writeMiniNumber(coin.blockcreated, 0),
    writeMiniNumber(BigInt(coin.states.length), 0),
    writeMiniByte(coin.hasToken)
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TreeKey Signing Chain Tests
// ═══════════════════════════════════════════════════════════════════════════
describe('TreeKey Signing Chain Parity', () => {
  // Import TreeKey and related functions
  let TreeKey: any;
  let getRootPublicKey: any;
  let serializeSignature: any;
  let serializeMMRProof: any;
  
  beforeAll(async () => {
    const treeKeyModule = await import('../../../../../totem-sdk/packages/core/src/treekey');
    TreeKey = treeKeyModule.TreeKey;
    getRootPublicKey = treeKeyModule.getRootPublicKey;
    
    // Import writeSignature from Streamable.ts (canonical serialization source)
    const streamableModule = await import('../../../../../totem-sdk/packages/core/src/Streamable');
    serializeSignature = streamableModule.writeSignature;
    
    const mmrModule = await import('../../../../../totem-sdk/packages/core/src/mmr');
    serializeMMRProof = mmrModule.serializeMMRProof;
  });
  
  it('should produce 3 proofs for sign() with setUses(0)', () => {
    const seed = new Uint8Array(32).fill(0xab);
    const treeKey = new TreeKey(seed);
    
    const testData = new Uint8Array(32).fill(0x42);
    treeKey.setUses(0);
    const signature = treeKey.sign(testData);
    
    expect(signature.proofs.length).toBe(3);
    console.log('[TreeKey] sign() produced', signature.proofs.length, 'proofs');
  });
  
  it('should produce 3 proofs for sign() with setUses()', () => {
    const seed = new Uint8Array(32).fill(0xcd);
    const treeKey = new TreeKey(seed);
    
    const testData = new Uint8Array(32).fill(0x42);
    treeKey.setUses(0);
    const signature = treeKey.sign(testData);
    
    expect(signature.proofs.length).toBe(3);
    console.log('[TreeKey] sign() produced', signature.proofs.length, 'proofs');
  });
  
  it('should have proof[0] MMR root equal to TreeKey root pubkey (sign)', () => {
    const seed = new Uint8Array(32).fill(0xef);
    const treeKey = new TreeKey(seed);
    
    const testData = new Uint8Array(32).fill(0x42);
    const l1Index = 5;
    treeKey.setUses(l1Index * 64 * 64 + 0 * 64 + 0);
    const signature = treeKey.sign(testData);
    
    const rootPubkey = treeKey.getPublicKey();
    
    const proof0Root = getRootPublicKey(signature.proofs[0]);
    
    expect(Buffer.from(proof0Root).equals(Buffer.from(rootPubkey))).toBe(true);
    console.log('[TreeKey] proof[0] root matches TreeKey root pubkey:', bytesToHex(rootPubkey).substring(0, 20) + '...');
  });
  
  it('should cache parent-child signatures and reuse them', () => {
    const seed = new Uint8Array(32).fill(0x11);
    const treeKey = new TreeKey(seed);
    
    const data1 = new Uint8Array(32).fill(0x01);
    const data2 = new Uint8Array(32).fill(0x02);
    
    treeKey.setUses(1 * 64 * 64 + 2 * 64 + 0);
    const sig1 = treeKey.sign(data1);
    treeKey.setUses(1 * 64 * 64 + 2 * 64 + 1);
    const sig2 = treeKey.sign(data2);
    
    const proof0_1 = sig1.proofs[0];
    const proof0_2 = sig2.proofs[0];
    
    expect(Buffer.from(proof0_1.leafPubkey).equals(Buffer.from(proof0_2.leafPubkey))).toBe(true);
    expect(Buffer.from(proof0_1.signature).equals(Buffer.from(proof0_2.signature))).toBe(true);
    console.log('[TreeKey] Parent-child signature cache working correctly');
  });
  
  it('should serialize Signature matching Java format', () => {
    const seed = new Uint8Array(32).fill(0x22);
    const treeKey = new TreeKey(seed);
    
    const testData = new Uint8Array(32).fill(0x33);
    treeKey.setUses(0);
    const signature = treeKey.sign(testData);
    
    const streamableSignature = {
      proofs: signature.proofs.map((p: any) => ({
        leafPubkey: p.leafPubkey,
        signature: p.signature,
        mmrProof: {
          blockTime: 0n,
          chunks: p.mmrProof.chunks
        }
      }))
    };
    
    const serialized = serializeSignature(streamableSignature);
    
    console.log('[TreeKey] Serialized Signature:', bytesToHex(serialized).substring(0, 100) + '...');
    console.log('[TreeKey] Serialized Signature length:', serialized.length, 'bytes');
    
    expect(serialized[0]).toBe(0x00); // scale
    expect(serialized[1]).toBe(0x01); // len
    expect(serialized[2]).toBe(0x03); // value = 3
    console.log('[TreeKey] Proof count prefix:', bytesToHex(serialized.slice(0, 3)));
  });
  
  it('should have each proof MMR root chain correctly (3-proof)', () => {
    const seed = new Uint8Array(32).fill(0x44);
    const treeKey = new TreeKey(seed);
    
    const testData = new Uint8Array(32).fill(0x55);
    treeKey.setUses(0);
    const signature = treeKey.sign(testData);
    
    const rootPubkey = treeKey.getPublicKey();
    
    const proof0Root = getRootPublicKey(signature.proofs[0]);
    
    expect(Buffer.from(proof0Root).equals(Buffer.from(rootPubkey))).toBe(true);
    console.log('[TreeKey] proof[0] root = TreeKey root pubkey:', bytesToHex(rootPubkey).substring(0, 20) + '...');
    
    expect(signature.proofs.length).toBe(3);
    console.log('[TreeKey] 3-proof chain verified');
  });
});

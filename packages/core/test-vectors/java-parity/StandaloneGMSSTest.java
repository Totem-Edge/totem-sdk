/**
 * Standalone GMSSRandom Test - No external dependencies
 * 
 * This implements the exact GMSSRandom algorithm from BouncyCastle
 * using Java's built-in SHA3-256 to verify our TypeScript matches.
 * 
 * Compile: javac StandaloneGMSSTest.java
 * Run: java StandaloneGMSSTest
 */

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;

public class StandaloneGMSSTest {
    
    private static MessageDigest sha3;
    
    public static void main(String[] args) throws NoSuchAlgorithmException {
        sha3 = MessageDigest.getInstance("SHA3-256");
        
        System.out.println("======================================================================");
        System.out.println("JAVA REFERENCE: GMSSRandom + WOTS Public Key Generation");
        System.out.println("======================================================================\n");
        
        // Test case from Minima TreeKey.main()
        byte[] privSeed = hexToBytes("51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1");
        
        System.out.println("INPUT:");
        System.out.println("  privSeed: " + bytesToHex(privSeed));
        
        // Step 1: Derive keySeed[0] = hashAllObjects(MiniNumber(0), MiniData(privSeed))
        System.out.println("\n--- STEP 1: Derive keySeed[0] ---");
        
        // MiniNumber(0) serialization: [scale=0x00, len=0x01, data=0x00]
        byte[] miniNumber0 = new byte[] { 0x00, 0x01, 0x00 };
        System.out.println("  MiniNumber(0): " + bytesToHex(miniNumber0));
        
        // MiniData(32-byte seed): [4-byte len big-endian, data]
        byte[] miniDataSeed = new byte[4 + 32];
        miniDataSeed[0] = 0x00;
        miniDataSeed[1] = 0x00;
        miniDataSeed[2] = 0x00;
        miniDataSeed[3] = 0x20; // 32
        System.arraycopy(privSeed, 0, miniDataSeed, 4, 32);
        System.out.println("  MiniData(privSeed): " + bytesToHex(miniDataSeed));
        
        // Concatenate and hash
        byte[] combined = new byte[miniNumber0.length + miniDataSeed.length];
        System.arraycopy(miniNumber0, 0, combined, 0, miniNumber0.length);
        System.arraycopy(miniDataSeed, 0, combined, miniNumber0.length, miniDataSeed.length);
        System.out.println("  Combined: " + bytesToHex(combined));
        
        byte[] keySeed0 = sha3Hash(combined);
        System.out.println("  keySeed[0] = SHA3-256(combined): " + bytesToHex(keySeed0));
        
        // Step 2: GMSSRandom expansion
        System.out.println("\n--- STEP 2: GMSSRandom.nextSeed (first 5 private keys) ---");
        byte[] state = Arrays.copyOf(keySeed0, 32);
        byte[][] privateKeys = new byte[34][];
        
        for (int i = 0; i < 34; i++) {
            byte[] pk = gmssRandomNextSeed(state);
            privateKeys[i] = pk;
            if (i < 5) {
                System.out.println("  pk[" + i + "]: " + bytesToHex(pk));
                System.out.println("    state_after: " + bytesToHex(state));
            }
        }
        System.out.println("  ...");
        System.out.println("  pk[33]: " + bytesToHex(privateKeys[33]));
        
        // Step 3: Hash chain (255 rounds each)
        System.out.println("\n--- STEP 3: Hash chain pk[0] for 255 rounds ---");
        byte[] chainTop0 = hashChain(privateKeys[0], 255);
        System.out.println("  H^255(pk[0]): " + bytesToHex(chainTop0));
        
        // Step 4: Full public key (34 chain tops concatenated)
        System.out.println("\n--- STEP 4: Full public key (1088 bytes) ---");
        byte[] fullPK = new byte[34 * 32];
        for (int i = 0; i < 34; i++) {
            byte[] top = hashChain(privateKeys[i], 255);
            System.arraycopy(top, 0, fullPK, i * 32, 32);
        }
        System.out.println("  First 64 bytes: " + bytesToHex(Arrays.copyOfRange(fullPK, 0, 64)));
        System.out.println("  Last 64 bytes: " + bytesToHex(Arrays.copyOfRange(fullPK, 1024, 1088)));
        
        // Step 5: WOTS public key digest
        System.out.println("\n--- STEP 5: WOTS Public Key Digest ---");
        byte[] pkDigest = sha3Hash(fullPK);
        System.out.println("  SHA3-256(fullPK): " + bytesToHex(pkDigest));
        
        System.out.println("\n======================================================================");
        System.out.println("Compare with TypeScript output to find divergence!");
        System.out.println("======================================================================");
    }
    
    private static byte[] gmssRandomNextSeed(byte[] state) {
        // rand = H(state)
        byte[] rand = sha3Hash(state);
        
        // state = state + rand (byte-wise little-endian addition with carry)
        addByteArrays(state, rand);
        
        // state = state + 1
        addOne(state);
        
        return rand;
    }
    
    private static void addByteArrays(byte[] a, byte[] b) {
        int overflow = 0;
        for (int i = 0; i < a.length; i++) {
            int temp = (a[i] & 0xFF) + (b[i] & 0xFF) + overflow;
            a[i] = (byte) temp;
            overflow = temp >>> 8;
        }
    }
    
    private static void addOne(byte[] a) {
        int overflow = 1;
        for (int i = 0; i < a.length; i++) {
            int temp = (a[i] & 0xFF) + overflow;
            a[i] = (byte) temp;
            overflow = temp >>> 8;
            if (overflow == 0) break;
        }
    }
    
    private static byte[] hashChain(byte[] data, int rounds) {
        byte[] result = Arrays.copyOf(data, data.length);
        for (int i = 0; i < rounds; i++) {
            result = sha3Hash(result);
        }
        return result;
    }
    
    private static byte[] sha3Hash(byte[] data) {
        sha3.reset();
        return sha3.digest(data);
    }
    
    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
    
    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}

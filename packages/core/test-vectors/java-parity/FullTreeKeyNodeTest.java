/**
 * Full TreeKeyNode Test - Builds 64 WOTS keys and MMR tree
 * 
 * Compile: javac FullTreeKeyNodeTest.java
 * Run: java FullTreeKeyNodeTest
 */

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;

public class FullTreeKeyNodeTest {
    
    private static MessageDigest sha3;
    
    public static void main(String[] args) throws NoSuchAlgorithmException {
        sha3 = MessageDigest.getInstance("SHA3-256");
        
        System.out.println("======================================================================");
        System.out.println("JAVA REFERENCE: Full TreeKeyNode (64 keys)");
        System.out.println("======================================================================\n");
        
        byte[] privSeed = hexToBytes("51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1");
        int numKeys = 64;
        
        System.out.println("INPUT:");
        System.out.println("  privSeed: " + bytesToHex(privSeed));
        System.out.println("  numKeys: " + numKeys);
        System.out.println("  Expected pubkey (from Minima): f6d6379010b1f44c59942291e4a81166ffaad60d139be98920a2f546c6d8a165\n");
        
        // Step 1: Generate all 64 WOTS public key digests
        System.out.println("--- STEP 1: Generate 64 WOTS public key digests ---");
        byte[][] pkDigests = new byte[numKeys][];
        
        for (int i = 0; i < numKeys; i++) {
            byte[] keySeed = deriveKeySeed(privSeed, i);
            pkDigests[i] = deriveWotsPkDigest(keySeed);
            
            if (i < 4 || i == numKeys - 1) {
                System.out.println("  pkDigest[" + i + "]: " + bytesToHex(pkDigests[i]));
            } else if (i == 4) {
                System.out.println("  ...");
            }
        }
        
        // Step 2: Build MMR tree
        System.out.println("\n--- STEP 2: Build MMR tree from pkDigests ---");
        System.out.println("  Creating MMR leaf nodes (hash each pkDigest with MiniNumber.ZERO)...");
        
        byte[][] leafNodes = new byte[numKeys][];
        for (int i = 0; i < numKeys; i++) {
            leafNodes[i] = createMMRLeafNode(pkDigests[i]);
            if (i < 4) {
                System.out.println("  leaf[" + i + "].data: " + bytesToHex(leafNodes[i]));
            }
        }
        
        // Step 3: Build parent nodes up to root
        System.out.println("\n--- STEP 3: Build MMR parent nodes ---");
        byte[] mmrRoot = buildMMRRoot(leafNodes);
        
        System.out.println("\n--- RESULT ---");
        System.out.println("  MMR Root (TreeKeyNode pubkey): " + bytesToHex(mmrRoot));
        System.out.println("  Expected:                      f6d6379010b1f44c59942291e4a81166ffaad60d139be98920a2f546c6d8a165");
        System.out.println("  Match: " + (bytesToHex(mmrRoot).equals("f6d6379010b1f44c59942291e4a81166ffaad60d139be98920a2f546c6d8a165") ? "YES!" : "NO"));
        
        System.out.println("\n======================================================================");
        System.out.println("END");
        System.out.println("======================================================================");
    }
    
    private static byte[] deriveKeySeed(byte[] privSeed, int index) {
        // keySeed[i] = hashAllObjects(MiniNumber(i), MiniData(privSeed))
        byte[] miniNumber = serializeMiniNumber(index);
        byte[] miniData = serializeMiniData(privSeed);
        
        byte[] combined = new byte[miniNumber.length + miniData.length];
        System.arraycopy(miniNumber, 0, combined, 0, miniNumber.length);
        System.arraycopy(miniData, 0, combined, miniNumber.length, miniData.length);
        
        return sha3Hash(combined);
    }
    
    private static byte[] deriveWotsPkDigest(byte[] keySeed) {
        // GMSSRandom expansion + hash chains + final hash
        byte[] state = Arrays.copyOf(keySeed, 32);
        byte[][] privateKeys = new byte[34][];
        
        for (int i = 0; i < 34; i++) {
            privateKeys[i] = gmssRandomNextSeed(state);
        }
        
        // Hash chain each key 255 times
        byte[] fullPK = new byte[34 * 32];
        for (int i = 0; i < 34; i++) {
            byte[] top = hashChain(privateKeys[i], 255);
            System.arraycopy(top, 0, fullPK, i * 32, 32);
        }
        
        // Final hash
        return sha3Hash(fullPK);
    }
    
    private static byte[] createMMRLeafNode(byte[] pkDigest) {
        // MMRData.CreateMMRDataLeafNode(pubkey, MiniNumber.ZERO)
        // Formula: hash = hashAllObjects(MiniNumber.ZERO, zData, zSumValue)
        // where zData = pkDigest, zSumValue = MiniNumber.ZERO
        
        byte[] miniNumberZero = serializeMiniNumber(0);
        byte[] miniDataPkDigest = serializeMiniData(pkDigest);
        byte[] sumValueZero = serializeMiniNumber(0);
        
        byte[] combined = new byte[miniNumberZero.length + miniDataPkDigest.length + sumValueZero.length];
        int offset = 0;
        System.arraycopy(miniNumberZero, 0, combined, offset, miniNumberZero.length);
        offset += miniNumberZero.length;
        System.arraycopy(miniDataPkDigest, 0, combined, offset, miniDataPkDigest.length);
        offset += miniDataPkDigest.length;
        System.arraycopy(sumValueZero, 0, combined, offset, sumValueZero.length);
        
        return sha3Hash(combined);
    }
    
    private static byte[] createMMRParentNode(byte[] leftData, byte[] rightData) {
        // MMRData.CreateMMRDataParentNode(left, right)
        // Formula: hash = hashAllObjects(MiniNumber.ONE, leftData, rightData, leftSum + rightSum)
        // where sums are both ZERO, so combined sum is ZERO
        
        byte[] miniNumberOne = serializeMiniNumber(1);
        byte[] leftMiniData = serializeMiniData(leftData);
        byte[] rightMiniData = serializeMiniData(rightData);
        byte[] sumValueZero = serializeMiniNumber(0);
        
        byte[] combined = new byte[miniNumberOne.length + leftMiniData.length + rightMiniData.length + sumValueZero.length];
        int offset = 0;
        System.arraycopy(miniNumberOne, 0, combined, offset, miniNumberOne.length);
        offset += miniNumberOne.length;
        System.arraycopy(leftMiniData, 0, combined, offset, leftMiniData.length);
        offset += leftMiniData.length;
        System.arraycopy(rightMiniData, 0, combined, offset, rightMiniData.length);
        offset += rightMiniData.length;
        System.arraycopy(sumValueZero, 0, combined, offset, sumValueZero.length);
        
        return sha3Hash(combined);
    }
    
    private static byte[] buildMMRRoot(byte[][] leafNodes) {
        // Build tree bottom-up
        List<byte[]> currentLevel = new ArrayList<>();
        for (byte[] leaf : leafNodes) {
            currentLevel.add(leaf);
        }
        
        int level = 0;
        while (currentLevel.size() > 1) {
            List<byte[]> nextLevel = new ArrayList<>();
            
            for (int i = 0; i < currentLevel.size(); i += 2) {
                byte[] left = currentLevel.get(i);
                byte[] right = (i + 1 < currentLevel.size()) ? currentLevel.get(i + 1) : null;
                
                if (right != null) {
                    byte[] parent = createMMRParentNode(left, right);
                    nextLevel.add(parent);
                    
                    if (level == 0 && i < 4) {
                        System.out.println("  parent(" + i + "," + (i+1) + ").data: " + bytesToHex(parent));
                    }
                } else {
                    nextLevel.add(left);
                }
            }
            
            currentLevel = nextLevel;
            level++;
        }
        
        return currentLevel.get(0);
    }
    
    private static byte[] serializeMiniNumber(int n) {
        // MiniNumber format: [scale, len, data...]
        // For non-negative integers with scale 0
        if (n == 0) {
            return new byte[] { 0x00, 0x01, 0x00 };
        }
        
        // Convert to BigInteger-style bytes (two's complement, minimal)
        byte[] bytes;
        if (n < 128) {
            bytes = new byte[] { (byte) n };
        } else if (n < 32768) {
            if ((n & 0x80) != 0) {
                bytes = new byte[] { 0x00, (byte) (n & 0xFF), (byte) ((n >> 8) & 0xFF) };
            } else {
                bytes = new byte[] { (byte) (n & 0xFF), (byte) ((n >> 8) & 0xFF) };
            }
        } else {
            // General case - build big-endian then reverse for serialization
            List<Byte> byteList = new ArrayList<>();
            int temp = n;
            while (temp > 0) {
                byteList.add((byte) (temp & 0xFF));
                temp >>>= 8;
            }
            // Add leading zero if high bit set
            if ((byteList.get(byteList.size() - 1) & 0x80) != 0) {
                byteList.add((byte) 0);
            }
            bytes = new byte[byteList.size()];
            for (int i = 0; i < byteList.size(); i++) {
                bytes[bytes.length - 1 - i] = byteList.get(i);
            }
        }
        
        byte[] result = new byte[2 + bytes.length];
        result[0] = 0x00; // scale
        result[1] = (byte) bytes.length; // length
        System.arraycopy(bytes, 0, result, 2, bytes.length);
        return result;
    }
    
    private static byte[] serializeMiniData(byte[] data) {
        // MiniData format: [4-byte big-endian length, data...]
        byte[] result = new byte[4 + data.length];
        int len = data.length;
        result[0] = (byte) ((len >> 24) & 0xFF);
        result[1] = (byte) ((len >> 16) & 0xFF);
        result[2] = (byte) ((len >> 8) & 0xFF);
        result[3] = (byte) (len & 0xFF);
        System.arraycopy(data, 0, result, 4, data.length);
        return result;
    }
    
    private static byte[] gmssRandomNextSeed(byte[] state) {
        byte[] rand = sha3Hash(state);
        addByteArrays(state, rand);
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

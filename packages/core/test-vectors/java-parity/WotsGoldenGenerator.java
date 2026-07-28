/**
 * WOTS Golden Vector Generator
 * 
 * This Java class generates golden vectors using Minima's actual WOTS implementation.
 * Run this against the Minima JAR to produce reference values for TypeScript parity testing.
 * 
 * Usage:
 *   1. Download Minima JAR from https://github.com/minima-global/Minima
 *   2. Compile and run: 
 *      javac -cp minima.jar WotsGoldenGenerator.java
 *      java -cp .:minima.jar WotsGoldenGenerator
 * 
 * The output can be compared against TypeScript test output.
 */

import org.minima.objects.keys.TreeKeyNode;
import org.minima.objects.keys.Winternitz;
import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;
import org.minima.utils.Crypto;
import java.io.*;

public class WotsGoldenGenerator {
    
    public static void main(String[] args) {
        // Test seed: 32 bytes of 0x11
        byte[] seedBytes = new byte[32];
        for (int i = 0; i < 32; i++) {
            seedBytes[i] = 0x11;
        }
        MiniData seed = new MiniData(seedBytes);
        
        System.out.println("=== WOTS Golden Vector Generator ===");
        System.out.println();
        System.out.println("Test seed (hex): " + seed.to0xString());
        System.out.println();
        
        // Test MiniNumber serialization
        System.out.println("=== MiniNumber Serialization ===");
        testMiniNumberSerialization(0);
        testMiniNumberSerialization(1);
        testMiniNumberSerialization(127);
        testMiniNumberSerialization(128);
        testMiniNumberSerialization(256);
        testMiniNumberSerialization(65535);
        System.out.println();
        
        // Test MiniData serialization  
        System.out.println("=== MiniData Serialization ===");
        testMiniDataSerialization(seed);
        System.out.println();
        
        // Test hashAllObjects
        System.out.println("=== hashAllObjects (seed derivation) ===");
        for (int i = 0; i < 4; i++) {
            MiniData derived = Crypto.getInstance().hashAllObjects(new MiniNumber(i), seed);
            System.out.println("hashAllObjects(MiniNumber(" + i + "), seed) = " + derived.to0xString());
        }
        System.out.println();
        
        // Create TreeKeyNode and extract public keys
        System.out.println("=== TreeKeyNode Public Keys ===");
        TreeKeyNode tree = new TreeKeyNode(seed, 64);
        System.out.println("Tree root public key: " + tree.getPublicKey().to0xString());
        System.out.println();
        
        // Get individual WOTS keys
        System.out.println("=== Individual WOTS Key Public Keys ===");
        for (int i = 0; i < 4; i++) {
            Winternitz wots = tree.getWOTSKey(i);
            System.out.println("WOTS key " + i + " pubkey: " + wots.getPublicKey().to0xString());
        }
        System.out.println();
        
        // Test direct Winternitz creation (matching our TypeScript approach)
        System.out.println("=== Direct Winternitz Creation ===");
        for (int i = 0; i < 4; i++) {
            // This matches our TypeScript: derivePKdigest(seed, i)
            MiniData keySeed = Crypto.getInstance().hashAllObjects(new MiniNumber(i), seed);
            Winternitz wots = new Winternitz(keySeed);
            System.out.println("Winternitz(hashAllObjects(" + i + ", seed)).pubkey = " + wots.getPublicKey().to0xString());
        }
        System.out.println();
        
        // Output JSON format for easy comparison
        System.out.println("=== JSON Format for Test Vectors ===");
        System.out.println("{");
        System.out.println("  \"seed_hex\": \"" + bytesToHex(seedBytes) + "\",");
        System.out.println("  \"indices\": [0, 1, 2, 3],");
        System.out.print("  \"java_pubkeys\": [");
        for (int i = 0; i < 4; i++) {
            MiniData keySeed = Crypto.getInstance().hashAllObjects(new MiniNumber(i), seed);
            Winternitz wots = new Winternitz(keySeed);
            String pk = wots.getPublicKey().to0xString().substring(2).toLowerCase();
            System.out.print("\"" + pk + "\"");
            if (i < 3) System.out.print(", ");
        }
        System.out.println("],");
        System.out.print("  \"java_chain_seeds_key0\": [");
        for (int j = 0; j < 3; j++) {
            // Two-level derivation: first key seed, then chain seed
            MiniData keySeed = Crypto.getInstance().hashAllObjects(new MiniNumber(0), seed);
            MiniData chainSeed = Crypto.getInstance().hashAllObjects(new MiniNumber(j), keySeed);
            String cs = chainSeed.to0xString().substring(2).toLowerCase();
            System.out.print("\"" + cs + "\"");
            if (j < 2) System.out.print(", ");
        }
        System.out.println("]");
        System.out.println("}");
    }
    
    private static void testMiniNumberSerialization(int value) {
        try {
            MiniNumber num = new MiniNumber(value);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            DataOutputStream dos = new DataOutputStream(baos);
            num.writeDataStream(dos);
            dos.flush();
            byte[] data = baos.toByteArray();
            System.out.println("MiniNumber(" + value + ") serialized: " + bytesToHex(data));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    private static void testMiniDataSerialization(MiniData data) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            DataOutputStream dos = new DataOutputStream(baos);
            data.writeDataStream(dos);
            dos.flush();
            byte[] serialized = baos.toByteArray();
            System.out.println("MiniData serialized (first 40 bytes): " + bytesToHex(serialized).substring(0, Math.min(80, serialized.length * 2)));
            System.out.println("  Length prefix: " + bytesToHex(java.util.Arrays.copyOf(serialized, 4)));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}

/**
 * Golden Vector Generator - Java Version
 * 
 * Run this against a Minima node to get reference values for parity testing.
 * 
 * Usage:
 *   1. Place in Minima source directory
 *   2. Compile: javac -cp . GoldenVectorGenerator.java
 *   3. Run: java -cp . GoldenVectorGenerator
 * 
 * Compare output with TypeScript generate-golden-vectors.ts
 */

import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.TreeKeyNode;
import org.minima.objects.keys.Winternitz;
import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;
import org.minima.database.mmr.MMR;
import org.minima.database.mmr.MMRData;
import org.minima.utils.Crypto;
import java.io.*;

public class GoldenVectorGenerator {
    
    // Test seed from TreeKey.java main()
    static final String PRIV_SEED_HEX = "51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1";
    static final String EXPECTED_PUBKEY_HEX = "f6d6379010b1f44c59942291e4a81166ffaad60d139be98920a2f546c6d8a165";
    
    public static void main(String[] args) {
        System.out.println("======================================================================");
        System.out.println("GOLDEN VECTOR GENERATOR (JAVA) - Reference for TypeScript Parity");
        System.out.println("======================================================================");
        System.out.println();
        
        MiniData privSeed = new MiniData(PRIV_SEED_HEX);
        
        System.out.println("INPUT:");
        System.out.println("  Private seed: " + privSeed.to0xString().substring(2).toLowerCase());
        System.out.println("  Expected pubkey: " + EXPECTED_PUBKEY_HEX.toLowerCase());
        System.out.println();
        
        // Step 1: mChildSeed = Crypto.hashObject(privSeed)
        System.out.println("--- STEP 1: mChildSeed = Crypto.hashObject(privSeed) ---");
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            DataOutputStream dos = new DataOutputStream(baos);
            privSeed.writeDataStream(dos);
            dos.flush();
            byte[] serialized = baos.toByteArray();
            System.out.println("  privSeed serialized as MiniData: " + bytesToHex(serialized));
        } catch (Exception e) { e.printStackTrace(); }
        
        MiniData mChildSeed = Crypto.getInstance().hashObject(privSeed);
        System.out.println("  mChildSeed = SHA3-256(serialized): " + mChildSeed.to0xString().substring(2).toLowerCase());
        System.out.println();
        
        // Step 2: Key seed derivation
        System.out.println("--- STEP 2: Key seed derivation (first 4 keys) ---");
        System.out.println("  Formula: keySeed[i] = hashAllObjects(MiniNumber(i), privSeed)");
        System.out.println();
        
        for (int i = 0; i < 4; i++) {
            try {
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                DataOutputStream dos = new DataOutputStream(baos);
                new MiniNumber(i).writeDataStream(dos);
                dos.flush();
                System.out.println("  MiniNumber(" + i + ") = " + bytesToHex(baos.toByteArray()));
            } catch (Exception e) { e.printStackTrace(); }
            
            MiniData keySeed = Crypto.getInstance().hashAllObjects(new MiniNumber(i), privSeed);
            System.out.println("  keySeed[" + i + "] = " + keySeed.to0xString().substring(2).toLowerCase());
            System.out.println();
        }
        
        // Step 3: First key WOTS public key
        System.out.println("--- STEP 3: First WOTS key ---");
        MiniData keySeed0 = Crypto.getInstance().hashAllObjects(new MiniNumber(0), privSeed);
        Winternitz wots0 = new Winternitz(keySeed0);
        MiniData pk0 = wots0.getPublicKey();
        System.out.println("  Winternitz(keySeed[0]).getPublicKey() = " + pk0.to0xString().substring(2).toLowerCase());
        System.out.println("  Length: " + pk0.getLength() + " bytes");
        System.out.println();
        
        // Step 4: All 4 WOTS public keys
        System.out.println("--- STEP 4: First 4 WOTS public keys ---");
        MiniData[] pkDigests = new MiniData[4];
        for (int i = 0; i < 4; i++) {
            MiniData keySeed = Crypto.getInstance().hashAllObjects(new MiniNumber(i), privSeed);
            Winternitz wots = new Winternitz(keySeed);
            pkDigests[i] = wots.getPublicKey();
            System.out.println("  pkDigest[" + i + "] = " + pkDigests[i].to0xString().substring(2).toLowerCase());
        }
        System.out.println();
        
        // Step 5: MMR leaf nodes
        System.out.println("--- STEP 5: MMR Leaf Nodes ---");
        MMRData[] leaves = new MMRData[4];
        for (int i = 0; i < 4; i++) {
            leaves[i] = MMRData.CreateMMRDataLeafNode(pkDigests[i], MiniNumber.ZERO);
            System.out.println("  leaf[" + i + "].data = " + leaves[i].getData().to0xString().substring(2).toLowerCase());
        }
        System.out.println();
        
        // Step 6: MMR parent nodes
        System.out.println("--- STEP 6: MMR Parent Nodes ---");
        MMRData parent01 = MMRData.CreateMMRDataParentNode(leaves[0], leaves[1]);
        MMRData parent23 = MMRData.CreateMMRDataParentNode(leaves[2], leaves[3]);
        System.out.println("  parent(0,1).data = " + parent01.getData().to0xString().substring(2).toLowerCase());
        System.out.println("  parent(2,3).data = " + parent23.getData().to0xString().substring(2).toLowerCase());
        
        MMRData root4 = MMRData.CreateMMRDataParentNode(parent01, parent23);
        System.out.println("  ROOT (4 keys) = " + root4.getData().to0xString().substring(2).toLowerCase());
        System.out.println();
        
        // Step 7: Full TreeKeyNode (64 keys)
        System.out.println("--- STEP 7: Full TreeKeyNode (64 keys) ---");
        TreeKeyNode node = new TreeKeyNode(privSeed, 64);
        System.out.println("  TreeKeyNode pubkey: " + node.getPublicKey().to0xString().substring(2).toLowerCase());
        System.out.println("  Expected:           " + EXPECTED_PUBKEY_HEX.toLowerCase());
        System.out.println();
        
        // Step 8: Full TreeKey (3 levels)
        System.out.println("--- STEP 8: Full TreeKey (64 keys, 3 levels) ---");
        TreeKey treeKey = new TreeKey(privSeed, 64, 3);
        System.out.println("  TreeKey pubkey: " + treeKey.getPublicKey().to0xString().substring(2).toLowerCase());
        System.out.println("  Expected:       " + EXPECTED_PUBKEY_HEX.toLowerCase());
        System.out.println();
        
        System.out.println("======================================================================");
        System.out.println("END OF JAVA GOLDEN VECTOR GENERATION");
        System.out.println("======================================================================");
    }
    
    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}

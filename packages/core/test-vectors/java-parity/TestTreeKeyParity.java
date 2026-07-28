import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.Signature;
import org.minima.objects.keys.SignatureProof;
import org.minima.objects.base.MiniData;
import java.util.ArrayList;

/**
 * Generate TreeKey signature data for TypeScript parity testing
 */
public class TestTreeKeyParity {
    public static void main(String[] args) throws Exception {
        System.out.println("=== TreeKey Parity Test Data ===\n");
        
        // Create TreeKey with known seed
        MiniData privateSeed = new MiniData("0xDEADBEEF00000000000000000000000000000000000000000000000000000001");
        TreeKey treeKey = new TreeKey(privateSeed, 6, 3);  // 64 keys per level, 3 levels
        
        // Get key info
        MiniData rootPubkey = treeKey.getPublicKey();
        System.out.println("privateSeed: " + privateSeed.to0xString());
        System.out.println("rootPubkey (L0): " + rootPubkey.to0xString());
        System.out.println("keysPerLevel: 64");
        System.out.println("levels: 3");
        
        // Sign transaction data
        MiniData data = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        System.out.println("\nData to sign: " + data.to0xString());
        
        Signature sig = treeKey.sign(data);
        ArrayList<SignatureProof> proofs = sig.getAllSignatureProofs();
        
        System.out.println("\n=== Signature Structure (3-level full tree) ===");
        System.out.println("Total proofs: " + proofs.size());
        
        for (int i = 0; i < proofs.size(); i++) {
            SignatureProof sp = proofs.get(i);
            System.out.println("\nproof[" + i + "]:");
            System.out.println("  publickey: " + sp.getPublicKey().to0xString());
            System.out.println("  rootkey:   " + sp.getRootPublicKey().to0xString());
            System.out.println("  signature: " + sp.getSignature().to0xString().substring(0, 130) + "...");
        }
        
        // For address-based signing, we need to get L1 node pubkey
        // We can derive this from the first signature's structure
        System.out.println("\n=== Address-Based Signing Test ===");
        System.out.println("For address-based (2-proof) signing:");
        System.out.println("  SIGNEDBY pubkey = proof[0].rootkey = L0 root");
        System.out.println("  But for actual addresses, SIGNEDBY = L1 pubkey");
        System.out.println("  We need to extract L1 pubkey from the tree");
        
        // In Java TreeKey, we can't easily get L1 node pubkey directly
        // But we know proof[1].rootkey is the pubkey of the L1 node (child of root)
        System.out.println("\n  proof[1].rootkey should be L1 pubkey: " + proofs.get(1).getRootPublicKey().to0xString());
        
        // Verification test data for TypeScript
        System.out.println("\n=== TypeScript Verification Data ===");
        System.out.println("// Java values for parity testing:");
        System.out.println("const javaRootPubkey = '" + rootPubkey.to0xString().substring(2) + "';");
        System.out.println("const javaProof0Pk = '" + proofs.get(0).getPublicKey().to0xString().substring(2) + "';");
        System.out.println("const javaProof0Root = '" + proofs.get(0).getRootPublicKey().to0xString().substring(2) + "';");
        System.out.println("const javaProof0SigFirst64 = '" + proofs.get(0).getSignature().to0xString().substring(2, 130) + "';");
        System.out.println("const javaProof1Pk = '" + proofs.get(1).getPublicKey().to0xString().substring(2) + "';");
        System.out.println("const javaProof1Root = '" + proofs.get(1).getRootPublicKey().to0xString().substring(2) + "';");
        System.out.println("const javaProof2Pk = '" + proofs.get(2).getPublicKey().to0xString().substring(2) + "';");
        System.out.println("const javaProof2Root = '" + proofs.get(2).getRootPublicKey().to0xString().substring(2) + "';");
        System.out.println("const javaProof2SigFirst64 = '" + proofs.get(2).getSignature().to0xString().substring(2, 130) + "';");
    }
}

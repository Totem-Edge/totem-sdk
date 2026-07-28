import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.TreeKeyNode;
import org.minima.objects.keys.Signature;
import org.minima.objects.keys.SignatureProof;
import org.minima.objects.base.MiniData;
import java.util.ArrayList;

/**
 * Test TreeKey signature structure and verify order
 */
public class TestTreeKeyVerifyOrder {
    public static void main(String[] args) throws Exception {
        System.out.println("=== TreeKey Signature Structure Test ===\n");
        
        // Create a TreeKey with known seed (3-level tree)
        MiniData privateSeed = new MiniData("0xDEADBEEF00000000000000000000000000000000000000000000000000000001");
        TreeKey treeKey = new TreeKey(privateSeed, 6, 3);  // 6 bits = 64 keys, 3 levels
        
        // Get public key (this is Level-0 root)
        MiniData rootPubkey = treeKey.getPublicKey();
        System.out.println("TreeKey rootPubkey: " + rootPubkey.to0xString());
        
        // Sign some data
        MiniData data = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        System.out.println("Data to sign: " + data.to0xString());
        
        // Get signature
        Signature sig = treeKey.sign(data);
        ArrayList<SignatureProof> proofs = sig.getAllSignatureProofs();
        
        System.out.println("\n=== Signature Structure ===");
        System.out.println("Total proofs: " + proofs.size());
        
        for (int i = 0; i < proofs.size(); i++) {
            SignatureProof sp = proofs.get(i);
            System.out.println("\nProof[" + i + "]:");
            System.out.println("  publickey: " + sp.getPublicKey().to0xString());
            System.out.println("  rootkey:   " + sp.getRootPublicKey().to0xString());
            System.out.println("  signature: " + sp.getSignature().getLength() + " bytes");
        }
        
        // Verify the signature - use instance method
        System.out.println("\n=== Verification ===");
        boolean valid = treeKey.verify(rootPubkey, sig);
        System.out.println("treeKey.verify(rootPubkey, sig): " + valid);
    }
}

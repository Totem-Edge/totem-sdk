import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.TreeKeyNode;
import org.minima.objects.keys.SignatureProof;
import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;

/**
 * Test TreeKey signature structure and MMR proof computation
 */
public class TestMMRTreeParity {
    public static void main(String[] args) throws Exception {
        System.out.println("=== TreeKey Signature Parity Test ===\n");
        
        // Use same private seed as our TypeScript tests
        MiniData privSeed = new MiniData("0x51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1");
        
        // Create TreeKey with 64 keys and 3 levels (default)
        TreeKey treeKey = new TreeKey(privSeed, 64, 3);
        
        System.out.println("TreeKey root pubkey: " + treeKey.getPublicKey().to0xString());
        
        // Sign a test message
        MiniData testData = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        System.out.println("Test data (transaction ID): " + testData.to0xString());
        
        // Sign with specific key at use count 0
        org.minima.objects.keys.Signature sig = treeKey.sign(testData);
        
        System.out.println("\n=== Signature Structure ===");
        System.out.println("Number of proofs: " + sig.getAllSignatureProofs().size());
        
        int proofIdx = 0;
        for (SignatureProof proof : sig.getAllSignatureProofs()) {
            System.out.println("\n--- Proof[" + proofIdx + "] ---");
            System.out.println("  leafPubkey: " + proof.getPublicKey().to0xString() + " (" + proof.getPublicKey().getLength() + " bytes)");
            System.out.println("  signature length: " + proof.getSignature().getLength() + " bytes");
            System.out.println("  signature (first 64 bytes): " + proof.getSignature().to0xString().substring(0, Math.min(130, proof.getSignature().to0xString().length())));
            
            // Calculate root from proof
            MiniData rootPubkey = proof.getRootPublicKey();
            System.out.println("  getRootPublicKey(): " + rootPubkey.to0xString());
            
            proofIdx++;
        }
        
        System.out.println("\n=== Verification ===");
        System.out.println("Proof[0].getRootPublicKey() == TreeKey.getPublicKey() ?");
        System.out.println("  TreeKey pubkey: " + treeKey.getPublicKey().to0xString());
        SignatureProof firstProof = sig.getAllSignatureProofs().get(0);
        System.out.println("  First proof root: " + firstProof.getRootPublicKey().to0xString());
        System.out.println("  Match: " + firstProof.getRootPublicKey().isEqual(treeKey.getPublicKey()));
    }
}

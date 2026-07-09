import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.TreeKeyNode;
import org.minima.objects.keys.Signature;
import org.minima.objects.keys.SignatureProof;
import org.minima.objects.keys.Winternitz;
import org.minima.objects.base.MiniData;
import org.minima.utils.Crypto;
import java.util.ArrayList;

/**
 * Trace exactly what TreeKey.verify() does
 */
public class TestTreeKeyVerifyTrace {
    public static void main(String[] args) throws Exception {
        System.out.println("=== TreeKey.verify() Trace ===\n");
        
        MiniData privateSeed = new MiniData("0xDEADBEEF00000000000000000000000000000000000000000000000000000001");
        TreeKey treeKey = new TreeKey(privateSeed, 6, 3);
        
        MiniData rootPubkey = treeKey.getPublicKey();
        MiniData data = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        
        Signature sig = treeKey.sign(data);
        ArrayList<SignatureProof> proofs = sig.getAllSignatureProofs();
        
        // Manually trace TreeKey.verify logic
        // From Minima source, TreeKey.verify() does:
        // 1. First check: proofs[0].getRootPublicKey() == expectedRoot
        // 2. For each non-leaf: verifies that signature signs the child's getRootPublicKey()
        // 3. For leaf: signature signs DATA
        
        System.out.println("Step 1: Check first proof's MMR root");
        MiniData proof0Root = proofs.get(0).getRootPublicKey();
        System.out.println("  proof[0].getRootPublicKey(): " + proof0Root.to0xString());
        System.out.println("  expectedRoot (rootPubkey):   " + rootPubkey.to0xString());
        System.out.println("  Match: " + proof0Root.isEqual(rootPubkey));
        
        System.out.println("\nStep 2: For each non-leaf proof, verify it signs the child's getRootPublicKey()");
        
        // proof[0] should sign data that reconstructs to proof[1]'s rootkey
        // But wait - what EXACTLY does proof[0] sign?
        // The signature should verify against some message...
        
        // Actually, looking at TreeKey.verify source code pattern:
        // For proof[i], verify that the signature is valid for message = proof[i+1].getRootPublicKey()
        // And verify that recovered pubkey matches proof[i].getPublicKey()
        
        for (int i = 0; i < proofs.size() - 1; i++) {
            SignatureProof current = proofs.get(i);
            SignatureProof child = proofs.get(i + 1);
            
            MiniData currentPk = current.getPublicKey();
            MiniData currentSig = current.getSignature();
            MiniData childRoot = child.getRootPublicKey();
            
            System.out.println("\nproof[" + i + "] -> proof[" + (i+1) + "]:");
            System.out.println("  current.publickey: " + currentPk.to0xString());
            System.out.println("  child.rootkey:     " + childRoot.to0xString());
            
            // Verify
            boolean valid = Winternitz.verify(currentPk, childRoot, currentSig);
            System.out.println("  Verify: " + valid);
        }
        
        // Leaf proof signs the DATA
        SignatureProof leaf = proofs.get(proofs.size() - 1);
        System.out.println("\nLeaf proof (proof[" + (proofs.size()-1) + "]) signs DATA:");
        System.out.println("  leaf.publickey: " + leaf.getPublicKey().to0xString());
        System.out.println("  DATA:           " + data.to0xString());
        boolean leafValid = Winternitz.verify(leaf.getPublicKey(), data, leaf.getSignature());
        System.out.println("  Verify: " + leafValid);
        
        // What does the actual DATA get signed?
        // In transactions, the "data" is the transaction's transactionID
        // Let me check if the data gets hashed internally by TreeKey.sign()
        System.out.println("\n=== Check if TreeKey hashes data internally ===");
        MiniData hashedData = Crypto.getInstance().hashObject(data);
        System.out.println("H(data): " + hashedData.to0xString());
        boolean leafValidHashedData = Winternitz.verify(leaf.getPublicKey(), hashedData, leaf.getSignature());
        System.out.println("Verify leaf with H(data): " + leafValidHashedData);
    }
}

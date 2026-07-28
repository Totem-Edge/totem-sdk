import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.TreeKeyNode;
import org.minima.objects.keys.Signature;
import org.minima.objects.keys.SignatureProof;
import org.minima.objects.keys.Winternitz;
import org.minima.objects.base.MiniData;
import java.util.ArrayList;

/**
 * Debug TreeKey verify failure
 */
public class TestTreeKeyVerifyDebug {
    public static void main(String[] args) throws Exception {
        System.out.println("=== TreeKey Verify Debug ===\n");
        
        MiniData privateSeed = new MiniData("0xDEADBEEF00000000000000000000000000000000000000000000000000000001");
        TreeKey treeKey = new TreeKey(privateSeed, 6, 3);
        
        MiniData rootPubkey = treeKey.getPublicKey();
        System.out.println("TreeKey rootPubkey: " + rootPubkey.to0xString());
        
        MiniData data = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        
        Signature sig = treeKey.sign(data);
        ArrayList<SignatureProof> proofs = sig.getAllSignatureProofs();
        
        System.out.println("\n=== Chain Validation ===");
        
        // Check: Does proof[0].rootkey match rootPubkey?
        MiniData proof0Root = proofs.get(0).getRootPublicKey();
        System.out.println("Proof[0].rootkey: " + proof0Root.to0xString());
        System.out.println("Expected:         " + rootPubkey.to0xString());
        System.out.println("Match: " + proof0Root.isEqual(rootPubkey));
        
        // Check: Does proof[0] sign proof[1].rootkey?
        // For TreeKey, proof[i] should sign proof[i+1].rootkey
        MiniData proof1Root = proofs.get(1).getRootPublicKey();
        System.out.println("\nProof[1].rootkey: " + proof1Root.to0xString());
        
        // Verify WOTS signature on proof[0]
        MiniData proof0Pubkey = proofs.get(0).getPublicKey();
        MiniData proof0Sig = proofs.get(0).getSignature();
        System.out.println("\nProof[0] signs: ?");
        System.out.println("  publickey: " + proof0Pubkey.to0xString());
        System.out.println("  signature: " + proof0Sig.getLength() + " bytes");
        
        // Try verifying proof[0] against proof[1].rootkey
        boolean proof0Valid = Winternitz.verify(proof0Pubkey, proof1Root, proof0Sig);
        System.out.println("  Verify(proof[0].pk, proof[1].root, proof[0].sig): " + proof0Valid);
        
        // Check: Does proof[1] sign proof[2].rootkey?
        MiniData proof2Root = proofs.get(2).getRootPublicKey();
        System.out.println("\nProof[2].rootkey: " + proof2Root.to0xString());
        
        MiniData proof1Pubkey = proofs.get(1).getPublicKey();
        MiniData proof1Sig = proofs.get(1).getSignature();
        boolean proof1Valid = Winternitz.verify(proof1Pubkey, proof2Root, proof1Sig);
        System.out.println("Verify(proof[1].pk, proof[2].root, proof[1].sig): " + proof1Valid);
        
        // Check: Does proof[2] (leaf) sign the actual DATA?
        MiniData proof2Pubkey = proofs.get(2).getPublicKey();
        MiniData proof2Sig = proofs.get(2).getSignature();
        boolean proof2Valid = Winternitz.verify(proof2Pubkey, data, proof2Sig);
        System.out.println("\nVerify(proof[2].pk, DATA, proof[2].sig): " + proof2Valid);
    }
}

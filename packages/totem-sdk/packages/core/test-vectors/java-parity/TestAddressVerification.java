import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.TreeKeyNode;
import org.minima.objects.keys.SignatureProof;
import org.minima.objects.keys.Signature;
import org.minima.objects.base.MiniData;
import java.lang.reflect.Field;
import java.util.ArrayList;

/**
 * Test verification with address-based (2-proof) signature
 * 
 * For address-based transactions:
 * - Script is: SIGNEDBY(L1_pubkey)  where L1_pubkey is the address public key
 * - Signature should have 2 proofs: [L1→L2, L2→DATA]
 * - proof[0].getRootPublicKey() should equal L1_pubkey
 */
public class TestAddressVerification {
    public static void main(String[] args) throws Exception {
        System.out.println("=== Address-Based Verification Test ===\n");
        
        MiniData privSeed = new MiniData("0x51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1");
        TreeKey treeKey = new TreeKey(privSeed, 64, 3);
        
        // Get L1[0] node for address signing
        Field rootField = TreeKey.class.getDeclaredField("mRoot");
        rootField.setAccessible(true);
        TreeKeyNode rootNode = (TreeKeyNode) rootField.get(treeKey);
        TreeKeyNode l1Node = rootNode.getChild(0);
        
        MiniData l1Pubkey = l1Node.getPublicKey();
        System.out.println("L1[0] address pubkey (for SIGNEDBY): " + l1Pubkey.to0xString());
        
        // Sign transaction ID
        MiniData txnId = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        System.out.println("Transaction ID: " + txnId.to0xString());
        
        // Get L2[0] node under L1[0]
        TreeKeyNode l2Node = l1Node.getChild(0);
        System.out.println("L2[0,0] pubkey: " + l2Node.getPublicKey().to0xString());
        
        // Now sign with L2 node at leaf index 0
        SignatureProof l2SignsData = l2Node.sign(0, txnId);
        System.out.println("\n--- L2→DATA signature (proof[1]) ---");
        System.out.println("  leafPubkey: " + l2SignsData.getPublicKey().to0xString());
        System.out.println("  signature first 64B: " + l2SignsData.getSignature().to0xString().substring(0, 130));
        System.out.println("  getRootPublicKey(): " + l2SignsData.getRootPublicKey().to0xString());
        System.out.println("  Expected to equal L2 node pubkey: " + l2SignsData.getRootPublicKey().isEqual(l2Node.getPublicKey()));
        
        // Now L1 signs the child's root (L2 node's pubkey)
        MiniData childRoot = l2SignsData.getRootPublicKey();
        SignatureProof l1SignsChild = l1Node.sign(0, childRoot);
        System.out.println("\n--- L1→L2 signature (proof[0]) ---");
        System.out.println("  Signing childRoot: " + childRoot.to0xString());
        System.out.println("  leafPubkey: " + l1SignsChild.getPublicKey().to0xString());
        System.out.println("  signature first 64B: " + l1SignsChild.getSignature().to0xString().substring(0, 130));
        System.out.println("  getRootPublicKey(): " + l1SignsChild.getRootPublicKey().to0xString());
        System.out.println("  Expected to equal L1 pubkey: " + l1SignsChild.getRootPublicKey().isEqual(l1Pubkey));
        
        // Verify: proof[0].getRootPublicKey() should equal L1 pubkey (for SIGNEDBY verification)
        System.out.println("\n=== Verification Check ===");
        System.out.println("SIGNEDBY pubkey: " + l1Pubkey.to0xString());
        System.out.println("proof[0].getRootPublicKey(): " + l1SignsChild.getRootPublicKey().to0xString());
        System.out.println("Match: " + l1SignsChild.getRootPublicKey().isEqual(l1Pubkey));
    }
}

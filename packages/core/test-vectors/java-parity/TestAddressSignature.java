import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.TreeKeyNode;
import org.minima.objects.base.MiniData;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

/**
 * Test address-based signing structure
 * The wallet uses L1 (address level) as the root, not L0 (TreeKey root)
 */
public class TestAddressSignature {
    public static void main(String[] args) throws Exception {
        System.out.println("=== Address-Based Signature Test ===\n");
        
        // Use same private seed as wallet tests
        MiniData privSeed = new MiniData("0x51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1");
        
        // Create TreeKey with 64 keys and 3 levels
        TreeKey treeKey = new TreeKey(privSeed, 64, 3);
        
        System.out.println("TreeKey L0 (root) pubkey: " + treeKey.getPublicKey().to0xString());
        
        // Get L1 node via reflection (getChild is private)
        // Actually, let's create a child TreeKeyNode directly
        
        // From TreeKeyNode.java constructor:
        // mChildSeed = Crypto.getInstance().hashObject(zPrivateSeed);
        // Then for child at index i:
        // MiniData seed = Crypto.getInstance().hashAllObjects(new MiniNumber(i), mChildSeed);
        
        // L1 address index from the wallet dump shows rootkey for L1
        // But we don't know which L1 index was used
        // Let's test with index 0
        
        System.out.println("\n--- L1 Address Public Keys (first 5) ---");
        
        // Use reflection to access the root node
        Field rootField = TreeKey.class.getDeclaredField("mRoot");
        rootField.setAccessible(true);
        TreeKeyNode rootNode = (TreeKeyNode) rootField.get(treeKey);
        
        for (int i = 0; i < 5; i++) {
            TreeKeyNode childNode = rootNode.getChild(i);
            System.out.println("L1[" + i + "] pubkey: " + childNode.getPublicKey().to0xString());
        }
        
        // Check if any matches the wallet's rootkey
        System.out.println("\n--- Searching for wallet's rootkey ---");
        String walletRootkey = "0x876935A87EC1B93EDC44DFAAEEF8ECF21708758D6136E6D4F6186F2B17B567F2";
        System.out.println("Looking for: " + walletRootkey);
        
        for (int i = 0; i < 64; i++) {
            TreeKeyNode childNode = rootNode.getChild(i);
            if (childNode.getPublicKey().to0xString().equalsIgnoreCase(walletRootkey)) {
                System.out.println("FOUND at L1 index " + i + "!");
                break;
            }
        }
    }
}

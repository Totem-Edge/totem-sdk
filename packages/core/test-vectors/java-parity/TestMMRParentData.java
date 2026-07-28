import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;
import org.minima.utils.Crypto;
import org.minima.database.mmr.MMRData;

/**
 * Test how Java creates MMR parent nodes
 */
public class TestMMRParentData {
    public static void main(String[] args) throws Exception {
        System.out.println("=== MMR Parent Data Construction Test ===\n");
        
        // Two WOTS public keys (first two keys in a TreeKeyNode)
        MiniData wotsPk0 = new MiniData("0xE19DC49ECE630013A87D38F5EA527634A2CB76987DF6BBF45CFC6041F80F9CAB");
        MiniData wotsPk1 = new MiniData("0xABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789");
        
        // Create leaf nodes
        MMRData leaf0 = MMRData.CreateMMRDataLeafNode(wotsPk0, MiniNumber.ZERO);
        MMRData leaf1 = MMRData.CreateMMRDataLeafNode(wotsPk1, MiniNumber.ZERO);
        
        System.out.println("Leaf 0 hash: " + leaf0.getData().to0xString());
        System.out.println("Leaf 1 hash: " + leaf1.getData().to0xString());
        
        // Create parent node
        // From MMRData.java CreateMMRDataParentNode:
        // hash = Crypto.hashAllObjects(MiniNumber.ONE, left.data, right.data, sumValue)
        MMRData parent = MMRData.CreateMMRDataParentNode(leaf0, leaf1);
        
        System.out.println("\nParent hash: " + parent.getData().to0xString());
        System.out.println("Parent value: " + parent.getValue());
        
        // Manual verification
        MiniNumber sumValue = leaf0.getValue().add(leaf1.getValue());
        MiniData manualHash = Crypto.getInstance().hashAllObjects(
            MiniNumber.ONE,      // Parent indicator
            leaf0.getData(),     // Left child hash
            leaf1.getData(),     // Right child hash
            sumValue             // Sum of values
        );
        System.out.println("\nManual hash: " + manualHash.to0xString());
        System.out.println("Match: " + manualHash.isEqual(parent.getData()));
    }
}

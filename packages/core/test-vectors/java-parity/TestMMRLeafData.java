import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;
import org.minima.utils.Crypto;
import org.minima.database.mmr.MMRData;

/**
 * Test how Java creates MMR leaf data from WOTS public keys
 */
public class TestMMRLeafData {
    public static void main(String[] args) throws Exception {
        System.out.println("=== MMR Leaf Data Construction Test ===\n");
        
        // A WOTS public key digest (32 bytes)
        MiniData wotsPubkey = new MiniData("0xE19DC49ECE630013A87D38F5EA527634A2CB76987DF6BBF45CFC6041F80F9CAB");
        System.out.println("WOTS pubkey: " + wotsPubkey.to0xString());
        
        // Create MMR leaf node (how TreeKeyNode does it)
        // From TreeKeyNode.java line 50-52:
        // MMRData mmrdata = MMRData.CreateMMRDataLeafNode(pubkey, MiniNumber.ZERO);
        MMRData leafData = MMRData.CreateMMRDataLeafNode(wotsPubkey, MiniNumber.ZERO);
        
        System.out.println("\nMMRData.CreateMMRDataLeafNode(wotsPubkey, 0):");
        System.out.println("  data hash: " + leafData.getData().to0xString());
        System.out.println("  value:     " + leafData.getValue());
        
        // What does the hash contain?
        // From MMRData.java line 30-36:
        // return Crypto.getInstance().hashAllObjects(MiniNumber.ZERO, zData, zValue);
        // This means: hash(serialize(MiniNumber.ZERO) || serialize(zData) || serialize(zValue))
        
        System.out.println("\n=== Manual hash computation ===");
        // Manually compute what CreateMMRDataLeafNode does:
        // hash = Crypto.hashAllObjects(MiniNumber.ZERO, zData, zValue)
        // where zData = wotsPubkey and zValue = MiniNumber.ZERO
        
        MiniData manualHash = Crypto.getInstance().hashAllObjects(
            MiniNumber.ZERO,   // First: MiniNumber.ZERO (leaf indicator)
            wotsPubkey,        // Second: the data (WOTS pubkey)
            MiniNumber.ZERO    // Third: sum value (always 0 for TreeKey leaves)
        );
        System.out.println("hashAllObjects(0, wotsPubkey, 0): " + manualHash.to0xString());
        System.out.println("Match: " + manualHash.isEqual(leafData.getData()));
    }
}

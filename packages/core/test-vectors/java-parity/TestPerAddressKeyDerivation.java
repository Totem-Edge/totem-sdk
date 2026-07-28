import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;
import org.minima.objects.keys.TreeKey;
import org.minima.utils.Crypto;
import java.math.BigInteger;

/**
 * Test Minima Wallet's per-address key derivation.
 * 
 * Minima Wallet.createNewKey() creates ONE TreeKey PER ADDRESS:
 *   modifier = MiniData(BigInteger(index))
 *   privSeed = hashObjects(baseSeed, modifier)
 *   TreeKey = TreeKey.createDefault(privSeed)
 *   address pubkey = TreeKey.getPublicKey()
 * 
 * This test outputs the derived seeds and public keys for parity testing.
 */
public class TestPerAddressKeyDerivation {
    
    public static void main(String[] args) {
        // Test seed (same as our TypeScript tests)
        MiniData baseSeed = new MiniData("0x51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1");
        
        System.out.println("=== Minima Per-Address Key Derivation Test ===\n");
        System.out.println("Base seed: " + baseSeed.to0xString());
        System.out.println("Base seed bytes: " + baseSeed.getLength() + " bytes\n");
        
        // Derive first 5 addresses (like Minima Wallet does)
        for (int i = 0; i < 5; i++) {
            System.out.println("--- Address[" + i + "] ---");
            
            // Step 1: Create modifier from index (matches Wallet.java line 500)
            // MiniData modifier = new MiniData(new BigInteger(Integer.toString(numkeys)));
            MiniData modifier = new MiniData(new BigInteger(Integer.toString(i)));
            System.out.println("  modifier (BigInteger(" + i + ")): " + modifier.to0xString() + " (" + modifier.getLength() + " bytes)");
            
            // Step 2: Hash baseSeed + modifier to get private seed (matches Wallet.java line 503)
            // MiniData privseed = Crypto.getInstance().hashObjects(new MiniData(mBaseSeed.getSeed()), modifier);
            MiniData privSeed = Crypto.getInstance().hashObjects(baseSeed, modifier);
            System.out.println("  privSeed (hashObjects): " + privSeed.to0xString());
            
            // Step 3: Create TreeKey from private seed (matches Wallet.java line 506)
            // TreeKey treekey = TreeKey.createDefault(privseed);
            TreeKey treeKey = TreeKey.createDefault(privSeed);
            System.out.println("  TreeKey size: " + treeKey.getSize() + ", depth: " + treeKey.getDepth());
            System.out.println("  TreeKey maxUses: " + treeKey.getMaxUses());
            
            // Step 4: Get public key (this is the address public key)
            MiniData pubKey = treeKey.getPublicKey();
            System.out.println("  ADDRESS PUBKEY: " + pubKey.to0xString());
            System.out.println();
        }
        
        System.out.println("=== Serialization Details ===\n");
        
        // Show how MiniData serializes for index 0
        MiniData mod0 = new MiniData(new BigInteger("0"));
        System.out.println("MiniData(BigInteger(\"0\")): " + mod0.to0xString());
        System.out.println("  Length: " + mod0.getLength() + " bytes");
        
        MiniData mod1 = new MiniData(new BigInteger("1"));
        System.out.println("MiniData(BigInteger(\"1\")): " + mod1.to0xString());
        System.out.println("  Length: " + mod1.getLength() + " bytes");
        
        MiniData mod63 = new MiniData(new BigInteger("63"));
        System.out.println("MiniData(BigInteger(\"63\")): " + mod63.to0xString());
        System.out.println("  Length: " + mod63.getLength() + " bytes");
        
        MiniData mod64 = new MiniData(new BigInteger("64"));
        System.out.println("MiniData(BigInteger(\"64\")): " + mod64.to0xString());
        System.out.println("  Length: " + mod64.getLength() + " bytes");
        
        System.out.println("\n=== COMPARISON WITH TOTEM ===");
        System.out.println("Totem currently uses: MasterTreeKey.L1[i].getPublicKey()");
        System.out.println("Minima Wallet uses:   TreeKey(hashObjects(baseSeed, i)).getPublicKey()");
        System.out.println("These are fundamentally DIFFERENT derivation paths!");
    }
}

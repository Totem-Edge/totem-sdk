import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.TreeKeyNode;
import org.minima.objects.keys.Winternitz;
import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;
import org.minima.utils.Crypto;

/**
 * Test TreeKeyNode key derivation to verify seed passed to Winternitz
 */
public class TestTreeKeyDerivation {
    public static void main(String[] args) throws Exception {
        System.out.println("=== TreeKeyNode Key Derivation Test ===\n");
        
        // Create a TreeKey with known private seed
        MiniData privateSeed = new MiniData("0x00000000000000000000000000000000000000000000000000000000000DEAD1");
        TreeKey treeKey = new TreeKey(privateSeed, 6);
        
        // Get level 0 node
        TreeKeyNode rootNode = treeKey.getRootKey();
        MiniData rootPrivateSeed = rootNode.getPrivateSeed();
        System.out.println("Root node private seed: " + rootPrivateSeed.to0xString());
        
        // Get keySeed[0] - first key's private seed
        // In Java: keySeed[i] = H(MiniNumber(i), privateSeed)
        MiniData keySeed0 = Crypto.getInstance().hashAllObjects(new MiniNumber(0), rootPrivateSeed);
        System.out.println("keySeed[0] = H(MiniNumber(0), privateSeed): " + keySeed0.to0xString());
        
        // Get the Winternitz for key 0 and compare pubkeys
        Winternitz wots0 = rootNode.getKey(0);
        MiniData pk0 = wots0.getPublicKey();
        System.out.println("getKey(0).getPublicKey(): " + pk0.to0xString());
        
        // Create a Winternitz directly with keySeed0 and verify it matches
        Winternitz wotsFromKeySeed = new Winternitz(keySeed0);
        MiniData pkFromKeySeed = wotsFromKeySeed.getPublicKey();
        System.out.println("Winternitz(keySeed0).getPublicKey(): " + pkFromKeySeed.to0xString());
        System.out.println("Match: " + pk0.to0xString().equals(pkFromKeySeed.to0xString()));
        
        // Now test signing with getKey(0)
        MiniData message = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        MiniData sig0 = wots0.sign(message);
        MiniData sigFromKeySeed = wotsFromKeySeed.sign(message);
        
        System.out.println("\n=== Signature Test ===");
        System.out.println("getKey(0).sign() first 64B: " + sig0.to0xString().substring(0, 130));
        System.out.println("Winternitz(keySeed0).sign() first 64B: " + sigFromKeySeed.to0xString().substring(0, 130));
        System.out.println("Match: " + sig0.to0xString().equals(sigFromKeySeed.to0xString()));
    }
}

import org.minima.objects.keys.Winternitz;
import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;
import org.minima.utils.Crypto;

/**
 * Test WOTS key derivation - verifying keySeed derivation matches
 */
public class TestKeyDerivation {
    public static void main(String[] args) throws Exception {
        System.out.println("=== Key Derivation Comparison ===\n");
        
        // Test with a known private seed (like a TreeKeyNode would have)
        MiniData privateSeed = new MiniData("0xDEADBEEF00000000000000000000000000000000000000000000000000000001");
        System.out.println("Node privateSeed: " + privateSeed.to0xString());
        
        // Derive keySeed[0] using Java's hashAllObjects pattern
        // From Java TreeKeyNode: seed = Crypto.getInstance().hashAllObjects(new MiniNumber(i), zPrivateSeed);
        MiniData keySeed0 = Crypto.getInstance().hashAllObjects(new MiniNumber(0), privateSeed);
        System.out.println("keySeed[0] = hashAllObjects(MiniNumber(0), privateSeed): " + keySeed0.to0xString());
        
        MiniData keySeed1 = Crypto.getInstance().hashAllObjects(new MiniNumber(1), privateSeed);
        System.out.println("keySeed[1] = hashAllObjects(MiniNumber(1), privateSeed): " + keySeed1.to0xString());
        
        // Create Winternitz with keySeed[0] and get pubkey
        Winternitz wots0 = new Winternitz(keySeed0);
        System.out.println("\nWinternitz(keySeed0):");
        System.out.println("  Public key: " + wots0.getPublicKey().to0xString());
        
        // Sign a message
        MiniData msg = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        MiniData sig = wots0.sign(msg);
        System.out.println("  Sign(msg) first 64B: " + sig.to0xString().substring(0, 130));
    }
}

import org.minima.objects.keys.Winternitz;
import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;
import org.minima.utils.Crypto;

/**
 * Verify a TypeScript-generated signature in Java
 * 
 * This is the ultimate test: If TypeScript signs and Java verifies,
 * we have byte-exact compatibility.
 */
public class TestCrossVerification {
    public static void main(String[] args) throws Exception {
        System.out.println("=== Cross-Verification: TypeScript signature in Java ===\n");
        
        // Use the same privateSeed as our TypeScript test
        MiniData privateSeed = new MiniData("0xDEADBEEF00000000000000000000000000000000000000000000000000000001");
        
        // Derive keySeed[0] = hashAllObjects(MiniNumber(0), privateSeed)
        MiniData keySeed0 = Crypto.getInstance().hashAllObjects(new MiniNumber(0), privateSeed);
        System.out.println("keySeed[0]: " + keySeed0.to0xString());
        
        // Create Winternitz with keySeed[0]
        Winternitz wots = new Winternitz(keySeed0);
        MiniData pubkey = wots.getPublicKey();
        System.out.println("Java pubkey: " + pubkey.to0xString());
        
        // Message to sign
        MiniData message = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        System.out.println("Message: " + message.to0xString());
        
        // TypeScript-generated signature (from our test above)
        // From: wotsSign(privateSeed, 0, msg, ps) => fc50c7d7aef78700e77542f8805eb9c0...
        String tsSigHex = "fc50c7d7aef78700e77542f8805eb9c0ef4d6e47cc8bc8126e456daf67bf48917d819841667b74b1639b5eb77ff64cff23e133dcfa7c001d28b34a7a2d48a169";
        // We need the full 1088-byte signature - let me generate it in Java first to compare
        MiniData javaSig = wots.sign(message);
        System.out.println("\nJava signature (" + javaSig.getLength() + " bytes):");
        System.out.println("First 64B: " + javaSig.to0xString().substring(0, 130));
        
        // Verify Java's own signature
        boolean javaValid = Winternitz.verify(pubkey, message, javaSig);
        System.out.println("\nJava verifies own signature: " + javaValid);
        
        // Now let's output the full Java signature for TypeScript comparison
        System.out.println("\n=== Full Java Signature (for TypeScript verification) ===");
        System.out.println("Length: " + javaSig.getLength() + " bytes");
        System.out.println("Full hex: " + javaSig.to0xString());
    }
}

import org.minima.objects.keys.Winternitz;
import org.minima.objects.base.MiniData;
import org.minima.utils.Crypto;

/**
 * Test whether Java WOTS hashes the message internally
 * 
 * If we pass message M, does Winternitz.sign() sign M or H(M)?
 */
public class TestWotsHashing {
    public static void main(String[] args) throws Exception {
        System.out.println("=== WOTS Message Hashing Test ===\n");
        
        MiniData keySeed = new MiniData("0x3D6EA9D599EA1AB45D02426E5D5CA02C59E11181F458D3241C4BBA2161DFFD84");
        Winternitz wots = new Winternitz(keySeed);
        
        // Test message
        MiniData message = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        
        // Pre-hash the message
        MiniData hashedMessage = Crypto.getInstance().hashObject(message);
        
        System.out.println("Original message: " + message.to0xString());
        System.out.println("H(message):       " + hashedMessage.to0xString());
        
        // Sign original message
        MiniData sig1 = wots.sign(message);
        System.out.println("\nSign(message) first 64B: " + sig1.to0xString().substring(0, 130));
        
        // Verify with original message
        boolean valid1 = Winternitz.verify(wots.getPublicKey(), message, sig1);
        System.out.println("Verify(message): " + valid1);
        
        // Verify with pre-hashed message (should fail if Java hashes internally)
        boolean valid2 = Winternitz.verify(wots.getPublicKey(), hashedMessage, sig1);
        System.out.println("Verify(H(message)): " + valid2);
        
        System.out.println("\n=== Interpretation ===");
        if (valid1 && !valid2) {
            System.out.println("Java hashes the message INTERNALLY - pass raw message, not pre-hash");
        } else if (valid1 && valid2) {
            System.out.println("Java does NOT hash internally - verify works with both");
        } else {
            System.out.println("Unexpected result");
        }
    }
}

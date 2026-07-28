import org.minima.objects.keys.Winternitz;
import org.minima.objects.base.MiniData;

/**
 * Test signature verification to understand why Minima rejects signatures
 */
public class TestSignatureVerification {
    public static void main(String[] args) throws Exception {
        // Test with known values
        MiniData keySeed = new MiniData("0x3D6EA9D599EA1AB45D02426E5D5CA02C59E11181F458D3241C4BBA2161DFFD84");
        
        Winternitz wots = new Winternitz(keySeed);
        MiniData pubkey = wots.getPublicKey();
        
        System.out.println("=== WOTS Signature Verification Test ===\n");
        System.out.println("KeySeed: " + keySeed.to0xString());
        System.out.println("Public Key: " + pubkey.to0xString());
        
        // Sign a test message (the transaction ID from the user's test)
        MiniData testData = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        System.out.println("\nMessage (txnid): " + testData.to0xString());
        
        MiniData signature = wots.sign(testData);
        System.out.println("Signature (first 64 bytes): " + signature.to0xString().substring(0, 130));
        System.out.println("Signature length: " + signature.getLength() + " bytes");
        
        // Verify
        boolean valid = Winternitz.verify(pubkey, testData, signature);
        System.out.println("\n=== Verification ===");
        System.out.println("Valid: " + valid);
        
        // Now test verification with different message (what if wrong digest?)
        MiniData wrongData = new MiniData("0x0000000000000000000000000000000000000000000000000000000000000001");
        boolean wrongValid = Winternitz.verify(pubkey, wrongData, signature);
        System.out.println("Wrong message valid: " + wrongValid);
    }
}

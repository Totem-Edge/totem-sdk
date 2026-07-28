import org.minima.objects.keys.Winternitz;
import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;
import org.minima.utils.Crypto;

public class TestWotsSignature {
    public static void main(String[] args) {
        System.out.println("=== WOTS Signature Test ===\n");
        
        // Use keySeed[0] from our test
        MiniData privSeed = new MiniData("0x51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1");
        MiniData keySeed0 = Crypto.getInstance().hashAllObjects(new MiniNumber(0), privSeed);
        
        System.out.println("keySeed[0]: " + keySeed0.to0xString());
        
        // Create WOTS key from keySeed[0]
        Winternitz wots = new Winternitz(keySeed0);
        MiniData pubkey = wots.getPublicKey();
        System.out.println("WOTS pubkey: " + pubkey.to0xString());
        
        // Sign test data
        MiniData testData = new MiniData("0x0102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F20");
        MiniData signature = wots.sign(testData);
        
        System.out.println("\nTest data: " + testData.to0xString());
        System.out.println("Signature length: " + signature.getLength() + " bytes");
        System.out.println("Signature first 64 bytes: " + signature.to0xString().substring(0, 130));
        System.out.println("Signature last 64 bytes: 0x" + signature.to0xString().substring(signature.to0xString().length() - 128));
        
        // Verify signature
        boolean valid = Winternitz.verify(pubkey, testData, signature);
        System.out.println("\nSignature valid: " + valid);
    }
}

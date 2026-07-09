import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.TreeKeyNode;
import org.minima.objects.keys.SignatureProof;
import org.minima.objects.keys.Signature;
import org.minima.objects.base.MiniData;
import java.lang.reflect.Field;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;

/**
 * Full signature parity test - dump all bytes for comparison
 */
public class TestFullSignature {
    public static void main(String[] args) throws Exception {
        System.out.println("=== Full Signature Parity Test ===\n");
        
        MiniData privSeed = new MiniData("0x51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1");
        TreeKey treeKey = new TreeKey(privSeed, 64, 3);
        
        // Sign transaction ID
        MiniData txnId = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        System.out.println("Transaction ID: " + txnId.to0xString());
        System.out.println("TreeKey pubkey: " + treeKey.getPublicKey().to0xString());
        
        // Sign at use=0 which maps to indices (0, 0, 0)
        Signature sig = treeKey.sign(txnId);
        
        System.out.println("\n=== Signature proofs ===");
        int idx = 0;
        for (SignatureProof proof : sig.getAllSignatureProofs()) {
            System.out.println("\nproof[" + idx + "]:");
            System.out.println("  leafPubkey (32B): " + proof.getPublicKey().to0xString());
            System.out.println("  signature first 64B: " + proof.getSignature().to0xString().substring(0, 130));
            System.out.println("  getRootPublicKey(): " + proof.getRootPublicKey().to0xString());
            idx++;
        }
        
        // Serialize the whole signature for comparison
        System.out.println("\n=== Serialized Signature ===");
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        DataOutputStream dos = new DataOutputStream(baos);
        sig.writeDataStream(dos);
        dos.flush();
        byte[] sigBytes = baos.toByteArray();
        System.out.println("Total bytes: " + sigBytes.length);
        System.out.println("First 100 bytes: " + bytesToHex(sigBytes, 0, 100));
        System.out.println("Last 50 bytes: " + bytesToHex(sigBytes, sigBytes.length - 50, 50));
    }
    
    static String bytesToHex(byte[] bytes, int offset, int length) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length && (offset + i) < bytes.length; i++) {
            sb.append(String.format("%02x", bytes[offset + i]));
        }
        return sb.toString();
    }
}

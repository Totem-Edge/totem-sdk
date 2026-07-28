import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.Signature;
import org.minima.objects.keys.SignatureProof;
import org.minima.objects.base.MiniData;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.util.ArrayList;

/**
 * Test how Signature serializes (writeDataStream)
 */
public class TestSignatureSerialization {
    public static void main(String[] args) throws Exception {
        System.out.println("=== Signature Serialization Format ===\n");
        
        MiniData privateSeed = new MiniData("0xDEADBEEF00000000000000000000000000000000000000000000000000000001");
        TreeKey treeKey = new TreeKey(privateSeed, 6, 3);
        
        MiniData data = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        Signature sig = treeKey.sign(data);
        
        // Serialize the signature
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        DataOutputStream dos = new DataOutputStream(baos);
        sig.writeDataStream(dos);
        dos.flush();
        byte[] sigBytes = baos.toByteArray();
        
        System.out.println("Serialized Signature length: " + sigBytes.length + " bytes");
        System.out.println("First 100 bytes hex: " + bytesToHex(sigBytes, 0, 100));
        
        // Parse the format manually
        System.out.println("\n=== Format Analysis ===");
        int pos = 0;
        
        // First byte should be the proof count (as MiniNumber)
        // MiniNumber.WriteToStream writes length byte + data
        int proofCountLen = sigBytes[pos] & 0xFF;
        System.out.println("Offset " + pos + ": proofCount length byte = " + proofCountLen);
        pos++;
        
        if (proofCountLen > 0) {
            int proofCount = 0;
            for (int i = 0; i < proofCountLen; i++) {
                proofCount = (proofCount << 8) | (sigBytes[pos + i] & 0xFF);
            }
            System.out.println("Offset " + pos + ": proofCount value = " + proofCount);
            pos += proofCountLen;
        } else {
            System.out.println("proofCount = 0 (empty)");
        }
        
        // Now each SignatureProof
        ArrayList<SignatureProof> proofs = sig.getAllSignatureProofs();
        System.out.println("\n=== SignatureProof Format ===");
        
        for (int i = 0; i < proofs.size(); i++) {
            SignatureProof sp = proofs.get(i);
            
            ByteArrayOutputStream spBaos = new ByteArrayOutputStream();
            DataOutputStream spDos = new DataOutputStream(spBaos);
            sp.writeDataStream(spDos);
            spDos.flush();
            byte[] spBytes = spBaos.toByteArray();
            
            System.out.println("\nSignatureProof[" + i + "]: " + spBytes.length + " bytes");
            System.out.println("  First 64 bytes: " + bytesToHex(spBytes, 0, Math.min(64, spBytes.length)));
            
            // Parse: MiniData pubkey + MiniData sig + MMRProof
            int spPos = 0;
            
            // MiniData (pubkey) = 4-byte length + data
            int pkLen = ((spBytes[spPos] & 0xFF) << 24) | ((spBytes[spPos+1] & 0xFF) << 16) | 
                       ((spBytes[spPos+2] & 0xFF) << 8) | (spBytes[spPos+3] & 0xFF);
            System.out.println("  pubkey: 4-byte len = " + pkLen + ", data = " + bytesToHex(spBytes, spPos+4, Math.min(32, pkLen)));
            spPos += 4 + pkLen;
            
            // MiniData (signature) = 4-byte length + data
            int sigLen = ((spBytes[spPos] & 0xFF) << 24) | ((spBytes[spPos+1] & 0xFF) << 16) |
                        ((spBytes[spPos+2] & 0xFF) << 8) | (spBytes[spPos+3] & 0xFF);
            System.out.println("  signature: 4-byte len = " + sigLen + " (expected 1088)");
            spPos += 4 + sigLen;
            
            // Rest is MMRProof
            System.out.println("  mmrProof: starts at offset " + spPos + ", remaining " + (spBytes.length - spPos) + " bytes");
        }
    }
    
    static String bytesToHex(byte[] bytes, int offset, int len) {
        StringBuilder sb = new StringBuilder();
        for (int i = offset; i < offset + len && i < bytes.length; i++) {
            sb.append(String.format("%02x", bytes[i]));
        }
        return sb.toString();
    }
}

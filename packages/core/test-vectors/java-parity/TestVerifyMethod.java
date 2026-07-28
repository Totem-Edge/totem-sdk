import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.Signature;
import org.minima.objects.keys.SignatureProof;
import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;
import java.util.ArrayList;
import java.lang.reflect.Method;

/**
 * Check verify method signature and what it expects
 */
public class TestVerifyMethod {
    public static void main(String[] args) throws Exception {
        System.out.println("=== TreeKey.verify() Method Analysis ===\n");
        
        // List all verify methods in TreeKey
        Method[] methods = TreeKey.class.getMethods();
        for (Method m : methods) {
            if (m.getName().equals("verify")) {
                System.out.println("Found: " + m);
            }
        }
        
        MiniData privateSeed = new MiniData("0xDEADBEEF00000000000000000000000000000000000000000000000000000001");
        TreeKey treeKey = new TreeKey(privateSeed, 6, 3);
        
        MiniData rootPubkey = treeKey.getPublicKey();
        MiniData data = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        
        Signature sig = treeKey.sign(data);
        
        // The verify method takes rootPubkey and Signature
        // But it may need to know what data was signed...
        System.out.println("\n=== Checking Signature internal state ===");
        System.out.println("Signature has: " + sig.getAllSignatureProofs().size() + " proofs");
        
        // Maybe the signature stores the signed data?
        // Let me check what fields Signature has
        System.out.println("\nSignature class methods:");
        for (Method m : Signature.class.getMethods()) {
            if (m.getParameterCount() == 0 && m.getName().startsWith("get")) {
                System.out.println("  " + m.getName() + "()");
            }
        }
        
        // Check getSignedData
        try {
            Method getSignedData = Signature.class.getMethod("getSignedData");
            MiniData signedData = (MiniData) getSignedData.invoke(sig);
            System.out.println("\nSignature.getSignedData(): " + (signedData != null ? signedData.to0xString() : "null"));
        } catch (NoSuchMethodException e) {
            System.out.println("\nNo getSignedData() method");
        }
    }
}

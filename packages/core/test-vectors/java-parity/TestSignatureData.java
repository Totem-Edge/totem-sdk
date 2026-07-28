import org.minima.objects.keys.TreeKey;
import org.minima.objects.keys.Signature;
import org.minima.objects.keys.SignatureProof;
import org.minima.objects.base.MiniData;
import java.util.ArrayList;
import java.lang.reflect.Field;

/**
 * Check if Signature stores the signed data
 */
public class TestSignatureData {
    public static void main(String[] args) throws Exception {
        System.out.println("=== Signature Internal State ===\n");
        
        MiniData privateSeed = new MiniData("0xDEADBEEF00000000000000000000000000000000000000000000000000000001");
        TreeKey treeKey = new TreeKey(privateSeed, 6, 3);
        
        MiniData data = new MiniData("0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
        Signature sig = treeKey.sign(data);
        
        // List all fields in Signature class
        System.out.println("Signature class fields:");
        Field[] fields = Signature.class.getDeclaredFields();
        for (Field f : fields) {
            f.setAccessible(true);
            Object val = f.get(sig);
            if (val instanceof MiniData) {
                System.out.println("  " + f.getName() + " = " + ((MiniData)val).to0xString());
            } else if (val != null) {
                System.out.println("  " + f.getName() + " = " + val);
            } else {
                System.out.println("  " + f.getName() + " = null");
            }
        }
        
        // Check SignatureProof for similar
        System.out.println("\nSignatureProof class fields (first proof):");
        SignatureProof sp = sig.getAllSignatureProofs().get(0);
        fields = SignatureProof.class.getDeclaredFields();
        for (Field f : fields) {
            f.setAccessible(true);
            Object val = f.get(sp);
            if (val instanceof MiniData) {
                System.out.println("  " + f.getName() + " = " + ((MiniData)val).to0xString());
            } else if (val != null) {
                String valStr = val.toString();
                if (valStr.length() > 100) valStr = valStr.substring(0, 100) + "...";
                System.out.println("  " + f.getName() + " = " + valStr);
            } else {
                System.out.println("  " + f.getName() + " = null");
            }
        }
    }
}

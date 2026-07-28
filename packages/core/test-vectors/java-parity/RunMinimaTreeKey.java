import org.minima.objects.keys.TreeKey;
import org.minima.objects.base.MiniData;

public class RunMinimaTreeKey {
    public static void main(String[] args) {
        MiniData priv = new MiniData("0x51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1");
        
        System.out.println("Creating TreeKey with privSeed, 64 keys, 3 levels...");
        TreeKey tester = new TreeKey(priv, 64, 3);
        
        MiniData pktest = tester.getPublicKey();
        
        System.out.println("Private Seed: " + priv.to0xString());
        System.out.println("Public Key:   " + pktest.to0xString());
        System.out.println();
        System.out.println("Expected (from main()): 0xf6d6379010b1f44c59942291e4a81166ffaad60d139be98920a2f546c6d8a165");
        System.out.println("Match: " + pktest.to0xString().equalsIgnoreCase("0xf6d6379010b1f44c59942291e4a81166ffaad60d139be98920a2f546c6d8a165"));
    }
}

import org.minima.objects.Transaction;
import org.minima.objects.Coin;
import org.minima.objects.base.MiniData;
import org.minima.objects.base.MiniNumber;

public class TestTransactionDigest {
    public static void main(String[] args) throws Exception {
        // Create a minimal transaction to understand what's being signed
        Transaction txn = new Transaction();
        
        // Add a simple input coin
        Coin input = new Coin(
            new MiniData("0x1C572D4DA0FBD4CD4B8D61148D322AE2C5B4479FB5DCFF0A1237635CF40CA0EB"),
            new MiniData("0x76670A207046BC483823E4EFCA21D80BDAE7BF19F38A08C60DE9250195CAFE79"),
            new MiniNumber("0.0001"),
            new MiniData("0x00")
        );
        txn.addInput(input);
        
        // Add output coin
        Coin output = new Coin(
            Coin.COINID_OUTPUT,
            new MiniData("0x9ED4779795A240E59EE646FFAE67934294073BB3953C8EDB25A4F3A0711B4CC8"),
            new MiniNumber("0.0001"),
            new MiniData("0x00")
        );
        txn.addOutput(output);
        
        // Get the transaction ID
        MiniData txnId = txn.getTransactionID();
        System.out.println("Transaction ID: " + txnId.to0xString());
        
        // Show what gets serialized
        System.out.println("\nExpected from wallet: 0xE5AA372D420CA66B6B388D00722E0B96AECA9BB607AB1A235BD54774475C68DE");
    }
}

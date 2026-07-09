/**
 * Example Node.js wallet application
 */

const { MinimaClient, MinimaWallet } = require('@totemsdk/node');

async function main() {
  // Initialize client
  const client = new MinimaClient({
    apiUrl: process.env.MINIMA_API_URL || 'https://rpc.axia.to/v1/totem-shared',
    apiKey: process.env.MINIMA_API_KEY,
    wsUrl: process.env.MINIMA_WS_URL || 'wss://rpc.axia.to/v1/events/ws'
  });

  // Connect to network
  console.log('Connecting to Minima network...');
  await client.connect();
  console.log('Connected!');

  // Listen for blocks
  client.on('block', (block) => {
    console.log('New block:', block.height);
  });

  // Create wallet
  const wallet = new MinimaWallet({
    client,
    password: process.env.WALLET_PASSWORD || 'demo-password'
  });

  // Initialize or load wallet
  try {
    await wallet.initialize();
    console.log('Wallet loaded');
  } catch (error) {
    console.log('Creating new wallet...');
    const mnemonic = wallet.generateMnemonic();
    console.log('Mnemonic:', mnemonic);
    console.log('SAVE THIS MNEMONIC SECURELY!');
    await wallet.initialize(mnemonic);
  }

  // Get accounts
  const accounts = wallet.getAccounts();
  console.log('\nAccounts:');
  for (const account of accounts) {
    console.log(`- ${account.address}`);
  }

  // Update balances
  console.log('\nUpdating balances...');
  await wallet.updateBalances();
  
  for (const account of wallet.getAccounts()) {
    console.log(`${account.address}: ${account.balance} MINIMA`);
  }

  // Example: Send transaction (commented out for safety)
  /*
  const txId = await wallet.sendTransaction({
    from: accounts[0].address,
    to: 'Mx1234567890...',
    amount: '1000000',
    fee: '1000'
  });
  console.log('Transaction sent:', txId);
  */

  // Keep connection alive
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    client.disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
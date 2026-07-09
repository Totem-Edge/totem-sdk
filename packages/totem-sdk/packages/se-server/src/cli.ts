import { loadConfigFromEnv, createSeServer } from './index';

async function main() {
  const config = loadConfigFromEnv();
  const se = createSeServer(config);
  await se.listen();
}

main().catch((err) => {
  console.error('[se-server] Fatal startup error:', err);
  process.exit(1);
});

import { createUpdateChecker } from '@totemsdk/manifest';
import { loadConfigFromEnv, createSeServer } from './index';

async function main() {
  const config = loadConfigFromEnv();
  const se = createSeServer(config);
  await se.listen();

  const updateUrl = process.env.TOTEM_UPDATE_CHECK_URL ?? process.env.OMNIA_UPDATE_CHECK_URL;
  if (updateUrl) {
    const checker = createUpdateChecker({
      url: updateUrl,
      onResult: (result) => {
        const updates = result.updates.map((u) => `${u.name} ${u.installed}->${u.recommended ?? u.newest}`);
        const advisories = result.advisories.map((a) => `${a.id}(${a.severity})`);
        console.log(`[se-server] updates available: ${updates.join(', ') || 'none'}${advisories.length ? `; advisories: ${advisories.join(', ')}` : ''}`);
      },
      onError: (error) => {
        console.warn('[se-server] update check failed:', error instanceof Error ? error.message : String(error));
      },
    });
    checker.start();
    process.once('exit', () => checker.stop());
  }
}

main().catch((err) => {
  console.error('[se-server] Fatal startup error:', err);
  process.exit(1);
});

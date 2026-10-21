import { test, expect } from './fixtures';

test.describe('headless webapp provider discovery', () => {
  test('injects the Totem provider into a normal web page', async ({ context }) => {
    await context.route('http://dapp.test/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>dapp</title></head><body><h1>dapp</h1></body></html>',
      });
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      (window as any).__totemAnnouncements = [];
      window.addEventListener('totem:announce', (event) => {
        (window as any).__totemAnnouncements.push((event as CustomEvent).detail);
      });
    });
    await page.goto('http://dapp.test/');
    await expect.poll(async () => page.evaluate(() => (window as any).__totemAnnouncements?.length ?? 0)).toBeGreaterThan(0);
    const announcement = await page.evaluate(() => (window as any).__totemAnnouncements[0]);
    expect(announcement.info).toMatchObject({ id: 'totem-extension', name: 'Totem Wallet' });
    expect(announcement.provider.isTotem).toBe(true);
    await page.close();
  });
});

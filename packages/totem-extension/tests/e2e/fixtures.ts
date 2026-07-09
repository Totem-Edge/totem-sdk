import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(__dirname, '../../dist');
const IS_CI = !!process.env.CI;

export interface ExtensionTestFixtures {
  context: BrowserContext;
  extensionId: string;
  popupPage: Page;
}

export const test = base.extend<ExtensionTestFixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: IS_CI,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--disable-popup-blocking',
        ...(IS_CI ? ['--headless=new'] : []),
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 30000 });
    }
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },

  popupPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;

export const TEST_MNEMONIC = 
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

export const TEST_PASSWORD = 'TestPassword123!';

export async function waitForOnboarding(page: Page): Promise<void> {
  await expect(page.getByText('TOTEM WALLET')).toBeVisible({ timeout: 15000 });
}

export async function waitForHome(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="home-balance"], .balance-display, text=/MINIMA/i')).toBeVisible({ timeout: 30000 });
}

export async function clearExtensionStorage(page: Page, extensionId: string): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.clear(() => resolve());
      } else {
        resolve();
      }
    });
  });
}

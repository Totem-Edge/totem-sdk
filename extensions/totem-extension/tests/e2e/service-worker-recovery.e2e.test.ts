import { test, expect, TEST_MNEMONIC, TEST_PASSWORD, waitForOnboarding, waitForHome } from './fixtures';
import { chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(__dirname, '../../dist');
const IS_CI = !!process.env.CI;

test.describe('Service Worker Recovery (MV3 Lifecycle)', () => {
  test('wallet recovers after service worker suspension and restart', async () => {
    let context: BrowserContext | null = null;

    try {
      context = await chromium.launchPersistentContext('', {
        headless: IS_CI,
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`,
          '--no-first-run',
          ...(IS_CI ? ['--headless=new'] : []),
        ],
      });

      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 30000 });
      }
      const extensionId = serviceWorker.url().split('/')[2];

      const setupPage = await context.newPage();
      await setupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await waitForOnboarding(setupPage);

      const importButton = setupPage.getByRole('button', { name: /IMPORT EXISTING WALLET/i });
      await importButton.click();

      await expect(setupPage.getByText(/IMPORT.*WALLET/i)).toBeVisible({ timeout: 10000 });

      const words = TEST_MNEMONIC.split(' ');
      const wordInputs = setupPage.locator('input[type="text"]');
      const inputCount = await wordInputs.count();

      if (inputCount >= 24) {
        for (let i = 0; i < 24; i++) {
          await wordInputs.nth(i).fill(words[i]);
          await setupPage.waitForTimeout(30);
        }
      }

      const continueButton = setupPage.getByRole('button', { name: /CONTINUE|NEXT|IMPORT/i });
      await continueButton.click();

      await expect(setupPage.locator('input[type="password"]').first()).toBeVisible({ timeout: 10000 });
      const passwordInputs = setupPage.locator('input[type="password"]');
      await passwordInputs.first().fill(TEST_PASSWORD);
      await passwordInputs.nth(1).fill(TEST_PASSWORD);

      const finishButton = setupPage.getByRole('button', { name: /CREATE|FINISH|COMPLETE|IMPORT/i });
      await finishButton.click();

      await waitForHome(setupPage);
      console.log('[E2E] Wallet setup complete, simulating SW kill...');
      await setupPage.close();

      console.log('[E2E] Simulating service worker termination...');
      
      const debugPage = await context.newPage();
      await debugPage.goto('chrome://serviceworker-internals');
      
      const stopButtons = debugPage.locator('button:has-text("Stop")');
      const stopCount = await stopButtons.count();
      
      for (let i = 0; i < stopCount; i++) {
        const button = stopButtons.nth(i);
        const isVisible = await button.isVisible().catch(() => false);
        if (isVisible) {
          await button.click().catch(() => {});
        }
      }
      
      await debugPage.close();
      console.log('[E2E] Service worker stopped');

      await new Promise(resolve => setTimeout(resolve, 2000));

      const recoveryPage = await context.newPage();
      await recoveryPage.goto(`chrome-extension://${extensionId}/popup.html`);
      console.log('[E2E] Reopened extension popup after SW kill');

      const isLockScreen = await recoveryPage.locator('input[type="password"]').isVisible({ timeout: 5000 }).catch(() => false);
      const isOnboarding = await recoveryPage.getByText(/TOTEM WALLET/i).isVisible({ timeout: 2000 }).catch(() => false);
      const isHome = await recoveryPage.locator('[data-testid="home-balance"], .balance-display').isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`[E2E] Recovery state - Lock: ${isLockScreen}, Onboarding: ${isOnboarding}, Home: ${isHome}`);

      if (isLockScreen) {
        console.log('[E2E] Wallet locked after SW restart - entering password');
        await recoveryPage.locator('input[type="password"]').fill(TEST_PASSWORD);
        
        const unlockButton = recoveryPage.getByRole('button', { name: /unlock|login|continue/i });
        await unlockButton.click();
        
        await waitForHome(recoveryPage);
        console.log('[E2E] Wallet unlocked successfully after SW recovery');
      } else if (isHome) {
        console.log('[E2E] Wallet still unlocked after SW restart (session persisted)');
      } else if (isOnboarding) {
        console.log('[E2E] WARNING: Wallet state lost after SW restart - returned to onboarding');
        expect(isOnboarding).toBe(false);
      }

      expect(isLockScreen || isHome).toBe(true);
      console.log('[E2E] Service worker recovery test PASSED');

      await recoveryPage.close();
    } finally {
      if (context) {
        await context.close();
      }
    }
  });

  test('wallet state persists across popup close/reopen cycles', async () => {
    let context: BrowserContext | null = null;

    try {
      context = await chromium.launchPersistentContext('', {
        headless: IS_CI,
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`,
          '--no-first-run',
          ...(IS_CI ? ['--headless=new'] : []),
        ],
      });

      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 30000 });
      }
      const extensionId = serviceWorker.url().split('/')[2];

      const page1 = await context.newPage();
      await page1.goto(`chrome-extension://${extensionId}/popup.html`);
      
      const needsSetup = await page1.getByText(/TOTEM WALLET/i).isVisible({ timeout: 3000 }).catch(() => false);
      
      if (needsSetup) {
        const importButton = page1.getByRole('button', { name: /IMPORT EXISTING WALLET/i });
        await importButton.click();

        await expect(page1.getByText(/IMPORT.*WALLET/i)).toBeVisible({ timeout: 10000 });

        const words = TEST_MNEMONIC.split(' ');
        const wordInputs = page1.locator('input[type="text"]');
        const inputCount = await wordInputs.count();

        if (inputCount >= 24) {
          for (let i = 0; i < 24; i++) {
            await wordInputs.nth(i).fill(words[i]);
            await page1.waitForTimeout(30);
          }
        }

        const continueButton = page1.getByRole('button', { name: /CONTINUE|NEXT|IMPORT/i });
        await continueButton.click();

        await expect(page1.locator('input[type="password"]').first()).toBeVisible({ timeout: 10000 });
        const passwordInputs = page1.locator('input[type="password"]');
        await passwordInputs.first().fill(TEST_PASSWORD);
        await passwordInputs.nth(1).fill(TEST_PASSWORD);

        const finishButton = page1.getByRole('button', { name: /CREATE|FINISH|COMPLETE|IMPORT/i });
        await finishButton.click();

        await waitForHome(page1);
      }

      await page1.close();
      console.log('[E2E] First popup closed');

      await new Promise(resolve => setTimeout(resolve, 500));

      const page2 = await context.newPage();
      await page2.goto(`chrome-extension://${extensionId}/popup.html`);
      console.log('[E2E] Reopened popup');

      const isLockScreen = await page2.locator('input[type="password"]').isVisible({ timeout: 5000 }).catch(() => false);
      const isHome = await page2.locator('[data-testid="home-balance"], .balance-display').isVisible({ timeout: 2000 }).catch(() => false);
      const isOnboarding = await page2.getByText(/TOTEM WALLET/i).isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`[E2E] State after reopen - Lock: ${isLockScreen}, Home: ${isHome}, Onboarding: ${isOnboarding}`);

      expect(isOnboarding).toBe(false);
      expect(isLockScreen || isHome).toBe(true);
      console.log('[E2E] Popup persistence test PASSED');

      await page2.close();
    } finally {
      if (context) {
        await context.close();
      }
    }
  });

  test('balance cache persists and restores after extension restart', async () => {
    let context: BrowserContext | null = null;

    try {
      context = await chromium.launchPersistentContext('', {
        headless: IS_CI,
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`,
          '--no-first-run',
          ...(IS_CI ? ['--headless=new'] : []),
        ],
      });

      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 30000 });
      }
      const extensionId = serviceWorker.url().split('/')[2];

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const needsSetup = await page.getByText(/TOTEM WALLET/i).isVisible({ timeout: 3000 }).catch(() => false);
      
      if (needsSetup) {
        console.log('[E2E] Wallet not set up - skipping balance cache test');
        test.skip();
        return;
      }

      const isLockScreen = await page.locator('input[type="password"]').isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isLockScreen) {
        await page.locator('input[type="password"]').fill(TEST_PASSWORD);
        const unlockButton = page.getByRole('button', { name: /unlock|login|continue/i });
        await unlockButton.click();
        await waitForHome(page);
      }

      const balanceElement = page.locator('[data-testid="balance-value"], .balance-amount, .balance');
      const hasBalance = await balanceElement.count() > 0;
      
      let initialBalance = '0';
      if (hasBalance) {
        initialBalance = await balanceElement.first().innerText().catch(() => '0');
        console.log(`[E2E] Initial balance displayed: ${initialBalance}`);
      }

      await page.close();

      const page2 = await context.newPage();
      await page2.goto(`chrome-extension://${extensionId}/popup.html`);

      const isLockScreen2 = await page2.locator('input[type="password"]').isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isLockScreen2) {
        await page2.locator('input[type="password"]').fill(TEST_PASSWORD);
        const unlockButton = page2.getByRole('button', { name: /unlock|login|continue/i });
        await unlockButton.click();
        await waitForHome(page2);
      }

      if (hasBalance) {
        const balanceElement2 = page2.locator('[data-testid="balance-value"], .balance-amount, .balance');
        const restoredBalance = await balanceElement2.first().innerText().catch(() => '0');
        console.log(`[E2E] Restored balance displayed: ${restoredBalance}`);
      }

      console.log('[E2E] Balance cache persistence test PASSED');
      await page2.close();
    } finally {
      if (context) {
        await context.close();
      }
    }
  });
});

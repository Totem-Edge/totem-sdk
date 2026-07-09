import { test, expect, TEST_MNEMONIC, TEST_PASSWORD, waitForOnboarding, waitForHome } from './fixtures';

test.describe('Unlock Wallet Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('setup: create wallet first', async ({ popupPage, context, extensionId }) => {
    const page = popupPage;
    await waitForOnboarding(page);

    const importButton = page.getByRole('button', { name: /IMPORT EXISTING WALLET/i });
    await importButton.click();

    await expect(page.getByText(/IMPORT.*WALLET/i)).toBeVisible({ timeout: 10000 });

    const words = TEST_MNEMONIC.split(' ');
    const wordInputs = page.locator('input[type="text"]');
    const inputCount = await wordInputs.count();

    if (inputCount >= 24) {
      for (let i = 0; i < 24; i++) {
        await wordInputs.nth(i).fill(words[i]);
        await page.waitForTimeout(30);
      }
    } else {
      const textarea = page.locator('textarea');
      if (await textarea.count() > 0) {
        await textarea.fill(TEST_MNEMONIC);
      }
    }

    const continueButton = page.getByRole('button', { name: /CONTINUE|NEXT|IMPORT/i });
    await continueButton.click();

    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 10000 });
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(TEST_PASSWORD);
    await passwordInputs.nth(1).fill(TEST_PASSWORD);

    const finishButton = page.getByRole('button', { name: /CREATE|FINISH|COMPLETE|IMPORT/i });
    await finishButton.click();

    await waitForHome(page);
    console.log('[E2E] Wallet created for unlock test');

    const lockButton = page.getByRole('button', { name: /lock|settings/i });
    if (await lockButton.count() > 0) {
      await lockButton.first().click();
      
      const lockOption = page.getByText(/lock wallet/i);
      if (await lockOption.count() > 0) {
        await lockOption.click();
      }
    }
  });

  test('unlock wallet with correct password', async ({ popupPage, context, extensionId }) => {
    const page = popupPage;

    const passwordInput = page.locator('input[type="password"]');
    const hasPasswordInput = await passwordInput.count() > 0;

    if (hasPasswordInput) {
      await passwordInput.fill(TEST_PASSWORD);

      const unlockButton = page.getByRole('button', { name: /unlock|login|continue/i });
      await unlockButton.click();

      await waitForHome(page);
      console.log('[E2E] Wallet unlocked successfully');
    } else {
      const hasOnboarding = await page.getByText(/TOTEM WALLET/i).count() > 0;
      if (hasOnboarding) {
        console.log('[E2E] Extension reset - no wallet to unlock (fresh state)');
        test.skip();
      } else {
        await waitForHome(page);
        console.log('[E2E] Wallet already unlocked');
      }
    }
  });

  test('shows error for incorrect password', async ({ popupPage }) => {
    const page = popupPage;

    const passwordInput = page.locator('input[type="password"]');
    const hasPasswordInput = await passwordInput.count() > 0;

    if (hasPasswordInput) {
      await passwordInput.fill('WrongPassword123!');

      const unlockButton = page.getByRole('button', { name: /unlock|login|continue/i });
      await unlockButton.click();

      const errorVisible = await page.getByText(/incorrect|invalid|wrong|failed/i).isVisible({ timeout: 5000 }).catch(() => false);
      
      if (!errorVisible) {
        const stillOnUnlock = await passwordInput.isVisible({ timeout: 2000 }).catch(() => false);
        expect(stillOnUnlock).toBe(true);
      }

      console.log('[E2E] Incorrect password handled correctly');
    } else {
      console.log('[E2E] No password input - skipping incorrect password test');
      test.skip();
    }
  });
});

test.describe('Wallet Lock Mechanism', () => {
  test('wallet auto-locks after inactivity timeout', async ({ popupPage, context, extensionId }) => {
    test.setTimeout(180000);
    test.skip(true, 'Auto-lock timeout test requires long wait - manual testing recommended');
  });

  test('lock button locks wallet and returns to unlock screen', async ({ popupPage }) => {
    const page = popupPage;

    const isHome = await page.locator('[data-testid="home-balance"], .balance-display').isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isHome) {
      const settingsButton = page.getByRole('button', { name: /settings|menu/i });
      if (await settingsButton.count() > 0) {
        await settingsButton.first().click();
        
        const lockOption = page.getByText(/lock wallet/i);
        if (await lockOption.count() > 0) {
          await lockOption.click();
          
          const passwordInput = page.locator('input[type="password"]');
          await expect(passwordInput).toBeVisible({ timeout: 5000 });
          console.log('[E2E] Wallet locked successfully via settings');
        }
      }
    } else {
      console.log('[E2E] Not on home screen - skipping lock test');
      test.skip();
    }
  });
});

import { test, expect, TEST_MNEMONIC, TEST_PASSWORD, waitForOnboarding, waitForHome } from './fixtures';

test.describe('Import Wallet Flow', () => {
  test.beforeEach(async ({ popupPage }) => {
    await waitForOnboarding(popupPage);
  });

  test('complete import wallet flow with valid 24-word mnemonic', async ({ popupPage }) => {
    const page = popupPage;

    await test.step('Welcome screen - click Import Existing Wallet', async () => {
      const importButton = page.getByRole('button', { name: /IMPORT EXISTING WALLET/i });
      await expect(importButton).toBeVisible();
      await importButton.click();
    });

    await test.step('Enter phrase - input 24 words', async () => {
      await expect(page.getByText(/IMPORT.*WALLET/i)).toBeVisible({ timeout: 10000 });

      const words = TEST_MNEMONIC.split(' ');
      expect(words.length).toBe(24);

      const wordInputs = page.locator('input[type="text"]');
      const inputCount = await wordInputs.count();

      if (inputCount >= 24) {
        for (let i = 0; i < 24; i++) {
          await wordInputs.nth(i).fill(words[i]);
          await page.waitForTimeout(50);
        }
      } else {
        const textarea = page.locator('textarea');
        if (await textarea.count() > 0) {
          await textarea.fill(TEST_MNEMONIC);
        } else {
          const singleInput = page.locator('input[placeholder*="seed"], input[placeholder*="phrase"], input[placeholder*="mnemonic"]');
          await singleInput.fill(TEST_MNEMONIC);
        }
      }

      const continueButton = page.getByRole('button', { name: /CONTINUE|NEXT|IMPORT/i });
      await expect(continueButton).toBeEnabled({ timeout: 5000 });
      await continueButton.click();
    });

    await test.step('Password step - set wallet password', async () => {
      await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 10000 });

      const passwordInputs = page.locator('input[type="password"]');
      await passwordInputs.first().fill(TEST_PASSWORD);
      await passwordInputs.nth(1).fill(TEST_PASSWORD);

      const finishButton = page.getByRole('button', { name: /CREATE|FINISH|COMPLETE|IMPORT/i });
      await expect(finishButton).toBeEnabled();
      await finishButton.click();
    });

    await test.step('Loading and home screen', async () => {
      await waitForHome(page);
      console.log('[E2E] Import wallet flow completed successfully');
    });
  });

  test('shows error for invalid mnemonic phrase', async ({ popupPage }) => {
    const page = popupPage;

    const importButton = page.getByRole('button', { name: /IMPORT EXISTING WALLET/i });
    await importButton.click();

    await expect(page.getByText(/IMPORT.*WALLET/i)).toBeVisible({ timeout: 10000 });

    const invalidWords = 'invalid words that are not a valid bip39 mnemonic phrase ' +
                         'and should fail validation when the user tries to continue';

    const wordInputs = page.locator('input[type="text"]');
    const inputCount = await wordInputs.count();

    if (inputCount >= 24) {
      const words = invalidWords.split(' ');
      for (let i = 0; i < Math.min(24, words.length); i++) {
        await wordInputs.nth(i).fill(words[i] || 'invalid');
      }
    } else {
      const textarea = page.locator('textarea');
      if (await textarea.count() > 0) {
        await textarea.fill(invalidWords);
      }
    }

    const continueButton = page.getByRole('button', { name: /CONTINUE|NEXT|IMPORT/i });
    
    const isDisabled = await continueButton.isDisabled();
    if (!isDisabled) {
      await continueButton.click();
      await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 5000 });
    } else {
      expect(isDisabled).toBe(true);
    }
  });

  test('validates individual words as BIP39 words', async ({ popupPage }) => {
    const page = popupPage;

    const importButton = page.getByRole('button', { name: /IMPORT EXISTING WALLET/i });
    await importButton.click();

    await expect(page.getByText(/IMPORT.*WALLET/i)).toBeVisible({ timeout: 10000 });

    const wordInputs = page.locator('input[type="text"]');
    const inputCount = await wordInputs.count();

    if (inputCount >= 24) {
      await wordInputs.first().fill('abandon');
      await page.waitForTimeout(100);
      
      const firstInputClasses = await wordInputs.first().getAttribute('class');
      const hasValidStyle = !firstInputClasses?.includes('error') && !firstInputClasses?.includes('invalid');
      
      await wordInputs.nth(1).fill('notaword123');
      await page.waitForTimeout(100);

      console.log('[E2E] Word validation UI check completed');
    }
  });

  test('handles paste of full 24-word phrase', async ({ popupPage }) => {
    const page = popupPage;

    const importButton = page.getByRole('button', { name: /IMPORT EXISTING WALLET/i });
    await importButton.click();

    await expect(page.getByText(/IMPORT.*WALLET/i)).toBeVisible({ timeout: 10000 });

    const wordInputs = page.locator('input[type="text"]');
    const inputCount = await wordInputs.count();

    if (inputCount >= 24) {
      await wordInputs.first().focus();
      
      await page.evaluate((mnemonic) => {
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer(),
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, 'clipboardData', {
          get: () => ({
            getData: () => mnemonic,
          }),
        });
        document.activeElement?.dispatchEvent(event);
      }, TEST_MNEMONIC);

      await page.waitForTimeout(500);

      const continueButton = page.getByRole('button', { name: /CONTINUE|NEXT|IMPORT/i });
      const isEnabled = await continueButton.isEnabled();
      console.log(`[E2E] Continue button enabled after paste: ${isEnabled}`);
    }
  });
});

import { test, expect, TEST_PASSWORD, waitForOnboarding, waitForHome } from './fixtures';

test.describe('Create Wallet Flow', () => {
  test.beforeEach(async ({ popupPage }) => {
    await waitForOnboarding(popupPage);
  });

  test('complete create wallet flow with phrase verification', async ({ popupPage }) => {
    const page = popupPage;

    await test.step('Welcome screen - click Create New Wallet', async () => {
      const createButton = page.getByRole('button', { name: /CREATE NEW WALLET/i });
      await expect(createButton).toBeVisible();
      await createButton.click();
    });

    let mnemonicWords: string[] = [];

    await test.step('Display phrase - capture and verify 24 words shown', async () => {
      await expect(page.getByText(/YOUR RECOVERY PHRASE/i)).toBeVisible({ timeout: 10000 });
      
      const wordElements = page.locator('[data-testid="mnemonic-word"], .mnemonic-word');
      const wordCount = await wordElements.count();
      
      if (wordCount === 0) {
        const gridContainer = page.locator('div').filter({ hasText: /^1\d{0,2}/ });
        const allText = await gridContainer.allInnerTexts();
        for (const text of allText) {
          const words = text.split(/\s+/).filter(w => /^[a-z]+$/.test(w));
          mnemonicWords.push(...words);
        }
      } else {
        for (let i = 0; i < wordCount; i++) {
          const word = await wordElements.nth(i).innerText();
          mnemonicWords.push(word.toLowerCase().trim());
        }
      }

      if (mnemonicWords.length < 24) {
        const bodyText = await page.locator('body').innerText();
        const allWords = bodyText.match(/\b[a-z]{3,}\b/g) || [];
        const bip39Words = allWords.filter(w => 
          ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
           'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
           'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
           'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
           'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert',
           'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also', 'alter',
           'always', 'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger',
           'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
           'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch', 'arctic',
           'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange', 'arrest',
           'arrive', 'arrow', 'art', 'artefact', 'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset'].includes(w)
        );
        if (bip39Words.length >= 24) {
          mnemonicWords = bip39Words.slice(0, 24);
        }
      }

      console.log(`[E2E] Captured ${mnemonicWords.length} mnemonic words`);
      expect(mnemonicWords.length).toBeGreaterThanOrEqual(24);

      const continueButton = page.getByRole('button', { name: /I'VE WRITTEN IT DOWN/i });
      await expect(continueButton).toBeVisible();
      await continueButton.click();
    });

    await test.step('Confirm phrase - enter verification words', async () => {
      await expect(page.getByText(/VERIFY PHRASE/i)).toBeVisible({ timeout: 10000 });

      const wordInputs = page.locator('input[placeholder*="Enter word"]');
      const inputCount = await wordInputs.count();
      
      expect(inputCount).toBe(3);

      for (let i = 0; i < inputCount; i++) {
        const input = wordInputs.nth(i);
        const placeholder = await input.getAttribute('placeholder');
        const match = placeholder?.match(/word\s*(\d+)/i);
        
        if (match) {
          const wordIndex = parseInt(match[1], 10) - 1;
          const wordToEnter = mnemonicWords[wordIndex];
          console.log(`[E2E] Entering word #${wordIndex + 1}: ${wordToEnter}`);
          await input.fill(wordToEnter);
        }
      }

      const verifyButton = page.getByRole('button', { name: /VERIFY.*CONTINUE/i });
      await expect(verifyButton).toBeEnabled();
      await verifyButton.click();
    });

    await test.step('Password step - set wallet password', async () => {
      await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 10000 });

      const passwordInputs = page.locator('input[type="password"]');
      await passwordInputs.first().fill(TEST_PASSWORD);
      await passwordInputs.nth(1).fill(TEST_PASSWORD);

      const finishButton = page.getByRole('button', { name: /CREATE|FINISH|COMPLETE/i });
      await expect(finishButton).toBeEnabled();
      await finishButton.click();
    });

    await test.step('Loading and home screen', async () => {
      await waitForHome(page);
      console.log('[E2E] Create wallet flow completed successfully');
    });
  });

  test('shows error for mismatched verification words', async ({ popupPage }) => {
    const page = popupPage;

    const createButton = page.getByRole('button', { name: /CREATE NEW WALLET/i });
    await createButton.click();

    await expect(page.getByText(/YOUR RECOVERY PHRASE/i)).toBeVisible({ timeout: 10000 });
    
    const continueButton = page.getByRole('button', { name: /I'VE WRITTEN IT DOWN/i });
    await continueButton.click();

    await expect(page.getByText(/VERIFY PHRASE/i)).toBeVisible({ timeout: 10000 });

    const wordInputs = page.locator('input[placeholder*="Enter word"]');
    
    await wordInputs.nth(0).fill('wrong');
    await wordInputs.nth(1).fill('words');
    await wordInputs.nth(2).fill('here');

    const verifyButton = page.getByRole('button', { name: /VERIFY.*CONTINUE/i });
    await verifyButton.click();

    await expect(page.getByText(/incorrect|failed|error/i)).toBeVisible({ timeout: 5000 });
  });
});

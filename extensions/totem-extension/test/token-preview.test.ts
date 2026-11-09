import './setup';

// The preview view model pulls in MinimaTransactionBuilder for the pure
// decimal helpers; mock the ESM-only noble module for Jest.
jest.mock('@noble/hashes/sha3.js', () => {
  const digest = () => new Uint8Array(32);
  const sha3_256: any = () => digest();
  sha3_256.arrayBuffer = () => digest().buffer;
  sha3_256.create = () => ({ update: () => undefined, digest });
  return { sha3_256 };
});

import { buildTransactionPreviewViewModel } from '../src/ui/components/molecules/TransactionPreview/ViewModelBuilder';

const bytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/^0x/i, '');
  return Uint8Array.from((clean.match(/../g) || []).map(h => parseInt(h, 16)));
};

const WALLET = '0x0DCA5F58F3EE4B8777A6F52A1F90E2B0D6EE2DDFB019367573E1CD916200AD04';
const RECIPIENT = '0x' + '22'.repeat(32);
const PORQ = '0x050DFE5A588A20C7CFA1336AB07A2F1784A943A0A43A0B40A708469C42DF62C1';

// 999 porq at scale 36 = 999e-36 MINIMA backing.
const porqBacking = (whole: string): string =>
  `0.${whole.padStart(36, '0')}`;

describe('token transaction preview scaling', () => {
  test('renders 9 porq (not 9.99 or 0.0000) when sending 9 of 999', () => {
    const transaction = {
      inputs: [
        {
          coinId: bytes('0x' + 'aa'.repeat(32)),
          address: bytes(WALLET),
          amount: porqBacking('999'),
          tokenId: bytes(PORQ),
          state: [],
        },
      ],
      outputs: [
        {
          address: bytes(RECIPIENT),
          amount: porqBacking('9'),
          tokenId: bytes(PORQ),
          state: [],
        },
        {
          address: bytes(WALLET),
          amount: porqBacking('990'),
          tokenId: bytes(PORQ),
          state: [],
        },
      ],
      state: [],
      linkHash: new Uint8Array(32),
    };

    const viewModel = buildTransactionPreviewViewModel({
      transaction: transaction as any,
      recipient: RECIPIENT,
      amount: '9',
      tokenSymbol: 'porq',
      tokenId: PORQ,
      sourceAddress: WALLET,
      sourceMode: 'focused',
      walletAddresses: [WALLET],
      tokenScale: 36,
    });

    // Recipient/summary amount: 9 porq.
    expect(viewModel.recipients).toHaveLength(1);
    expect(viewModel.recipients[0].amount.displayAmount).toBe('9');

    // Change: 990 porq, not a raw 0.000... value.
    expect(viewModel.change?.displayAmount).toBe('990');

    // Advanced input/output rows use token-aware display amounts.
    expect(viewModel.inputs[0].displayAmount).toBe('999');
    expect(viewModel.outputs.some(o => o.displayAmount === '9')).toBe(true);
    expect(viewModel.outputs.some(o => o.displayAmount === '990')).toBe(true);

    // Totals are in token units, not backing base units.
    expect(viewModel.totalIn[0].displayAmount).toBe('999');
    expect(viewModel.totalOut[0].displayAmount).toBe('999');
  });
});

import { createMinimaL1PaymentPort } from '../payment-l1';
import type { ChainStateProvider } from '@totemsdk/chain-provider';

function makeProvider(broadcastResult: { success: boolean; txpowid?: string; message?: string }) {
  return {
    broadcastTxPoW: jest.fn().mockResolvedValue(broadcastResult),
  } as unknown as ChainStateProvider;
}

describe('createMinimaL1PaymentPort — pay', () => {
  it('calls sign with correct params then broadcasts', async () => {
    const sign = jest.fn().mockResolvedValue('0xMINEDHEX');
    const provider = makeProvider({ success: true, txpowid: '0xTXPOWID' });
    const port = createMinimaL1PaymentPort({ provider, sign });

    const result = await port.pay({ recipient: 'MxABC', amount: '5', tokenId: '0xFEED' });

    expect(sign).toHaveBeenCalledWith({
      toAddress: 'MxABC',
      amount: '5',
      tokenId: '0xFEED',
      memo: undefined,
    });
    expect(provider.broadcastTxPoW).toHaveBeenCalledWith('0xMINEDHEX');
    expect(result.ok).toBe(true);
    expect(result.data?.txpowId).toBe('0xTXPOWID');
  });

  it('defaults tokenId to 0x00 when not provided', async () => {
    const sign = jest.fn().mockResolvedValue('0xHEX');
    const provider = makeProvider({ success: true, txpowid: '0xID' });
    const port = createMinimaL1PaymentPort({ provider, sign });

    await port.pay({ recipient: 'MxABC', amount: '1' });
    expect(sign).toHaveBeenCalledWith(expect.objectContaining({ tokenId: '0x00' }));
  });

  it('forwards memo to sign', async () => {
    const sign = jest.fn().mockResolvedValue('0xHEX');
    const provider = makeProvider({ success: true });
    const port = createMinimaL1PaymentPort({ provider, sign });
    await port.pay({ recipient: 'MxABC', amount: '1', memo: 'invoice-001' });
    expect(sign).toHaveBeenCalledWith(expect.objectContaining({ memo: 'invoice-001' }));
  });

  it('returns ok:false with BROADCAST_FAILED when broadcast fails', async () => {
    const sign = jest.fn().mockResolvedValue('0xHEX');
    const provider = makeProvider({ success: false, message: 'node rejected' });
    const port = createMinimaL1PaymentPort({ provider, sign });

    const result = await port.pay({ recipient: 'MxABC', amount: '1' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('BROADCAST_FAILED');
    expect(result.error).toContain('node rejected');
  });

  it('returns ok:false when sign throws', async () => {
    const sign = jest.fn().mockRejectedValue(new Error('insufficient balance'));
    const provider = makeProvider({ success: true });
    const port = createMinimaL1PaymentPort({ provider, sign });

    const result = await port.pay({ recipient: 'MxABC', amount: '999999' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('insufficient balance');
  });
});

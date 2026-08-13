import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { ChannelSigner, OmniaChannel, UpdateStateResult } from './types.js';
import { applyProgramTransition } from './channel.js';
import { getStateBigInt } from './state-vars.js';
import { METER_READING_PORT } from './program.js';

export async function recordMeterReading(
  channel: OmniaChannel,
  reading: bigint,
  unitPrice: bigint,
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<UpdateStateResult> {
  if (channel.parties.length < 2) throw new Error('MeterProgram requires payer and payee parties');
  const previousReading = getStateBigInt(channel.latestState, METER_READING_PORT, 0n);
  if (reading < previousReading) throw new Error('Meter reading cannot decrease');
  const payment = (reading - previousReading) * unitPrice;
  const payer = channel.parties[0].partyId;
  const payee = channel.parties[1].partyId;
  return applyProgramTransition(
    channel,
    {
      balances: {
        ...channel.balances,
        [payer]: channel.balances[payer] - payment,
        [payee]: channel.balances[payee] + payment,
      },
      transition: { action: 'record_reading', inputs: { reading, unitPrice } },
    },
    leaseProvider,
    signer,
  );
}

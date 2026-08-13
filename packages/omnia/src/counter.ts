import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { ChannelSigner, OmniaChannel, UpdateStateResult } from './types.js';
import { applyProgramTransition } from './channel.js';

export async function incrementCounter(
  channel: OmniaChannel,
  by: bigint,
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<UpdateStateResult> {
  return applyProgramTransition(
    channel,
    { transition: { action: 'increment', inputs: { by } } },
    leaseProvider,
    signer,
  );
}

export async function decrementCounter(
  channel: OmniaChannel,
  by: bigint,
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<UpdateStateResult> {
  return applyProgramTransition(
    channel,
    { transition: { action: 'decrement', inputs: { by } } },
    leaseProvider,
    signer,
  );
}

export async function setCounter(
  channel: OmniaChannel,
  value: bigint,
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<UpdateStateResult> {
  return applyProgramTransition(
    channel,
    { transition: { action: 'set', inputs: { value } } },
    leaseProvider,
    signer,
  );
}

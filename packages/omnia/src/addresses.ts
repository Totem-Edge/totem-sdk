import { wotsAddressData } from '@totemsdk/core';
import type { ChannelParticipant } from './types.js';

/**
 * Canonical settlement output address for a channel party.
 *
 * `settlementAddress` is the agreed address recorded in the channel's
 * participant set (part of the channel the counterparty verified at open).
 * When it is absent, the address is derived from the party's channel key, so it
 * is always bound to that key and can never be chosen by a peer message.
 *
 * The raw `publicKeyDigest` is a `SIGNEDBY` identity, not a spendable address;
 * paying it directly burns the funds.
 */
export function canonicalSettlementAddress(
  party: Pick<ChannelParticipant, 'publicKeyDigest' | 'settlementAddress'>,
): string {
  return party.settlementAddress ?? wotsAddressData(party.publicKeyDigest);
}

/**
 * Resolve the per-party settlement address map.
 *
 * A supplied map (e.g. from a peer's settlement request) may only *confirm* the
 * channel's agreed addresses. Any value that disagrees is rejected: a negotiated
 * message must never be able to redirect a settlement output.
 */
export function resolveSettlementAddresses(
  parties: ChannelParticipant[],
  supplied?: Record<string, string>,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const party of parties) {
    const canonical = canonicalSettlementAddress(party);
    const given = supplied?.[party.partyId];
    if (given !== undefined && given !== canonical) {
      throw new Error(
        `Settlement address for party ${party.partyId} does not match the channel's agreed address`,
      );
    }
    resolved[party.partyId] = canonical;
  }
  return resolved;
}

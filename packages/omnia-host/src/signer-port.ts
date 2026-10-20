/**
 * Local signer port (RFC-058 P1).
 *
 * Adapts the host's unified TreeKey signer + WOTS lease to the SDK `SignerPort`
 * contract. A hosted deployment supplies its own `SignerPort` (KMS/HSM/MPC +
 * policy) instead; the host code is agnostic.
 */

import { bytesToHex } from '@totemsdk/core';
import {
  assertSignRequest,
  signRequestPayload,
  type SignRequest,
  type SignerPort,
} from '@totemsdk/omnia';
import type { HostSigning } from './signing.js';

export function createLocalSignerPort(signing: HostSigning): SignerPort {
  return {
    publicKeyDigest: signing.publicKeyDigest,
    async sign(request: SignRequest): Promise<Uint8Array> {
      assertSignRequest(request);
      if (!request.signers.includes(signing.publicKeyDigest)) {
        throw new Error(`local signer ${signing.publicKeyDigest} is not a required signer for ${request.requestId}`);
      }

      const payload = signRequestPayload(request);
      if (request.signingIndices) {
        // Caller owns the lease (channel/factory tx signing); sign the exact leaf.
        return signing.signer.sign(payload, request.signingIndices);
      }
      const reservation = await signing.leaseProvider.reserveKeyUse({
        treeId: 'omnia-sign-request',
        purpose: `sign-request:${request.domain}`,
        payloadHash: bytesToHex(payload),
      });
      try {
        const signature = await signing.signer.sign(payload, reservation.indices);
        await signing.leaseProvider.commitKeyUse(
          reservation.reservationId,
          `sign-request:${request.domain}`,
        );
        return signature;
      } catch (err) {
        await signing.leaseProvider
          .burnReservation(reservation.reservationId, 'sign-request-failed')
          .catch(() => {});
        throw err;
      }
    },
  };
}

/**
 * Shared helpers for authenticating lease certificates.
 *
 * A certificate is authenticated by a real signature over a canonical,
 * deterministic byte encoding of its content. Providers that hold an issuing
 * identity (`certificateSigner`, or the watermark coin owner on Layer 5) sign
 * the payload before returning the certificate. Verifiers reject certificates
 * whose signature is missing or empty and, when they possess a `verify()`
 * function, cryptographically verify the signature.
 */

import { sha3_256, bytesToHex, hexToBytes } from '@totemsdk/core';
import type { CertificateSigner, LeaseCertificate } from './types.js';

/**
 * Canonical byte encoding of a certificate's bindable content.
 *
 * Any change to a bound field changes the message, so a certificate cannot
 * be re-targeted at a different reservation, device, purpose, or expiry.
 */
export function canonicalCertificateMessage(
  cert: Pick<
    LeaseCertificate,
    | 'treeId'
    | 'branchId'
    | 'deviceId'
    | 'indices'
    | 'purpose'
    | 'payloadHash'
    | 'reservationId'
    | 'issuedBy'
    | 'issuedAt'
    | 'expiresAt'
  >,
): Uint8Array {
  const encoded = new TextEncoder().encode(
    [
      'TOTEM-LEASECERT',
      'v1',
      cert.issuedBy ?? '',
      cert.treeId ?? '',
      cert.branchId ?? '',
      cert.deviceId ?? '',
      cert.reservationId ?? '',
      String(cert.indices?.addressIndex ?? 0),
      String(cert.indices?.l1 ?? 0),
      String(cert.indices?.l2 ?? 0),
      cert.purpose ?? '',
      cert.payloadHash ?? '',
      String(cert.issuedAt ?? 0),
      String(cert.expiresAt ?? 0),
    ].join('\x1f'),
  );
  return sha3_256(encoded);
}

/** Sign a certificate via the issuer identity, returning hex of the signature. */
export async function signCertificate(
  signer: { sign(message: Uint8Array): Promise<Uint8Array> },
  cert: Parameters<typeof canonicalCertificateMessage>[0],
): Promise<string> {
  return bytesToHex(await signer.sign(canonicalCertificateMessage(cert)));
}

/**
 * Verify a certificate's signature.
 *
 * - Empty/malformed signature -> false (an unsigned certificate is not
 *   authenticity evidence regardless of what issuedBy claims).
 * - When `signer` with a `verify()` function is provided, the signature must
 *   cryptographically verify against that identity.
 * - When only the identity is known (no verifier function, e.g. a remote
 *   verifier holding a digest), non-empty signature is required; the caller
 *   decides how strong that binding is.
 */
export async function certificateSignatureVerified(
  cert: LeaseCertificate,
  signer?: CertificateSigner,
): Promise<boolean> {
  if (typeof cert.signature !== 'string' || cert.signature.length === 0) {
    return false;
  }
  if (!signer) return true;
  if (!signer.verify) return true;
  let sig: Uint8Array;
  try {
    sig = hexToBytes(cert.signature);
  } catch {
    return false;
  }
  return signer.verify(canonicalCertificateMessage(cert), sig);
}
import { sha3_256 } from 'js-sha3';
import { 
  deserializeTreeSignature, 
  verifyTreeSignature, 
  type TreeSignature 
} from '../../../../totem-sdk/packages/core/src/treekey';
import { parseChallenge, digestChallenge, type VerifyChallenge } from './ChallengeBuilder';

export interface VerificationResult {
  valid: boolean;
  address?: string;
  challenge?: VerifyChallenge;
  error?: string;
}

export interface VerifyParams {
  message: string;
  signature: string;
  publicKey: string;
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new Error('Invalid hex string: contains non-hex characters');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function verifySignature(params: VerifyParams): VerificationResult {
  try {
    const { message, signature, publicKey } = params;
    
    const challenge = parseChallenge(message);
    if (!challenge) {
      return { valid: false, error: 'Invalid challenge message format' };
    }
    
    if (challenge.expiresAt < Date.now()) {
      return { 
        valid: false, 
        error: 'Challenge has expired',
        challenge,
        address: challenge.address
      };
    }
    
    const messageBytes = new TextEncoder().encode(message);
    const digestBytes = sha3_256.array(messageBytes);
    const digest = new Uint8Array(digestBytes);
    
    const signatureBytes = hexToBytes(signature);
    const publicKeyBytes = hexToBytes(publicKey);
    
    let treeSignature: TreeSignature;
    try {
      treeSignature = deserializeTreeSignature(signatureBytes);
    } catch (error: any) {
      return { 
        valid: false, 
        error: `Failed to deserialize signature: ${error.message}`,
        challenge,
        address: challenge.address
      };
    }
    
    const isValid = verifyTreeSignature(publicKeyBytes, digest, treeSignature);
    
    if (isValid) {
      return {
        valid: true,
        address: challenge.address,
        challenge
      };
    } else {
      return {
        valid: false,
        error: 'Signature verification failed',
        address: challenge.address,
        challenge
      };
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Unknown verification error'
    };
  }
}

export function verifyRawSignature(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  try {
    const treeSignature = deserializeTreeSignature(signature);
    return verifyTreeSignature(publicKey, data, treeSignature);
  } catch (error) {
    return false;
  }
}

export function createVerificationPayload(
  address: string,
  signature: string,
  publicKey: string,
  message: string
): string {
  const payload = {
    address,
    signature,
    publicKey,
    message,
    timestamp: Date.now()
  };
  return btoa(JSON.stringify(payload));
}

export function decodeVerificationPayload(payload: string): VerifyParams | null {
  try {
    const decoded = JSON.parse(atob(payload));
    if (!decoded.message || !decoded.signature || !decoded.publicKey) {
      return null;
    }
    return {
      message: decoded.message,
      signature: decoded.signature,
      publicKey: decoded.publicKey
    };
  } catch {
    return null;
  }
}

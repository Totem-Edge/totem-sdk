import { sha3_256 } from 'js-sha3';

export interface VerifyChallenge {
  domain: string;
  address: string;
  statement: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  chainId?: string;
  resources?: string[];
}

export interface SerializedChallenge {
  message: string;
  digest: Uint8Array;
  digestHex: string;
  challenge: VerifyChallenge;
}

const DEFAULT_EXPIRY_MS = 5 * 60 * 1000;
const MINIMA_CHAIN_ID = 'minima:mainnet';

export class ChallengeBuilder {
  private domain: string;
  private address: string;
  private statement: string;
  private nonce: string;
  private issuedAt: number;
  private expiresAt: number;
  private chainId: string;
  private resources: string[];

  constructor() {
    this.domain = '';
    this.address = '';
    this.statement = 'Sign this message to verify wallet ownership';
    this.nonce = this.generateNonce();
    this.issuedAt = Date.now();
    this.expiresAt = this.issuedAt + DEFAULT_EXPIRY_MS;
    this.chainId = MINIMA_CHAIN_ID;
    this.resources = [];
  }

  static create(): ChallengeBuilder {
    return new ChallengeBuilder();
  }

  static fromRequest(request: Partial<VerifyChallenge>): ChallengeBuilder {
    const builder = new ChallengeBuilder();
    
    if (request.domain) builder.setDomain(request.domain);
    if (request.address) builder.setAddress(request.address);
    if (request.statement) builder.setStatement(request.statement);
    if (request.nonce) builder.nonce = request.nonce;
    if (request.issuedAt) builder.issuedAt = request.issuedAt;
    if (request.expiresAt) builder.expiresAt = request.expiresAt;
    if (request.chainId) builder.chainId = request.chainId;
    if (request.resources) builder.resources = request.resources;
    
    return builder;
  }

  setDomain(domain: string): ChallengeBuilder {
    try {
      const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
      this.domain = url.origin;
    } catch {
      this.domain = domain;
    }
    return this;
  }

  setAddress(address: string): ChallengeBuilder {
    this.address = address;
    return this;
  }

  setStatement(statement: string): ChallengeBuilder {
    this.statement = statement;
    return this;
  }

  setNonce(nonce: string): ChallengeBuilder {
    this.nonce = nonce;
    return this;
  }

  setExpiry(expiryMs: number): ChallengeBuilder {
    this.expiresAt = this.issuedAt + expiryMs;
    return this;
  }

  setExpiresAt(timestamp: number): ChallengeBuilder {
    this.expiresAt = timestamp;
    return this;
  }

  setChainId(chainId: string): ChallengeBuilder {
    this.chainId = chainId;
    return this;
  }

  addResource(resource: string): ChallengeBuilder {
    this.resources.push(resource);
    return this;
  }

  private generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.domain) {
      errors.push('Domain is required');
    }
    if (!this.address) {
      errors.push('Address is required');
    }
    if (!this.address.startsWith('Mx') && !this.address.startsWith('0x')) {
      errors.push('Address must be a valid Minima address (Mx or 0x prefix)');
    }
    if (!this.nonce || this.nonce.length < 8) {
      errors.push('Nonce must be at least 8 characters');
    }
    if (this.expiresAt <= Date.now()) {
      errors.push('Challenge has expired');
    }
    if (this.expiresAt <= this.issuedAt) {
      errors.push('Expiry must be after issue time');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  build(): SerializedChallenge {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Invalid challenge: ${validation.errors.join(', ')}`);
    }

    const challenge: VerifyChallenge = {
      domain: this.domain,
      address: this.address,
      statement: this.statement,
      nonce: this.nonce,
      issuedAt: this.issuedAt,
      expiresAt: this.expiresAt,
      chainId: this.chainId,
      resources: this.resources.length > 0 ? this.resources : undefined
    };

    const message = this.serializeMessage(challenge);
    const messageBytes = new TextEncoder().encode(message);
    const digestBytes = sha3_256.array(messageBytes);
    const digest = new Uint8Array(digestBytes);
    const digestHex = '0x' + Array.from(digest)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      message,
      digest,
      digestHex,
      challenge
    };
  }

  private serializeMessage(challenge: VerifyChallenge): string {
    const lines: string[] = [
      `${challenge.domain} wants you to sign in with your Minima account:`,
      challenge.address,
      '',
      challenge.statement,
      '',
      `URI: ${challenge.domain}`,
      `Chain ID: ${challenge.chainId}`,
      `Nonce: ${challenge.nonce}`,
      `Issued At: ${new Date(challenge.issuedAt).toISOString()}`,
      `Expiration Time: ${new Date(challenge.expiresAt).toISOString()}`
    ];

    if (challenge.resources && challenge.resources.length > 0) {
      lines.push('Resources:');
      for (const resource of challenge.resources) {
        lines.push(`- ${resource}`);
      }
    }

    return lines.join('\n');
  }

  getChallenge(): VerifyChallenge {
    return {
      domain: this.domain,
      address: this.address,
      statement: this.statement,
      nonce: this.nonce,
      issuedAt: this.issuedAt,
      expiresAt: this.expiresAt,
      chainId: this.chainId,
      resources: this.resources.length > 0 ? this.resources : undefined
    };
  }
}

export function parseChallenge(message: string): VerifyChallenge | null {
  try {
    const lines = message.split('\n');
    
    const domainMatch = lines[0]?.match(/^(.+) wants you to sign in with your Minima account:$/);
    if (!domainMatch) return null;

    const domain = domainMatch[1];
    const address = lines[1];
    
    let statement = '';
    let currentLine = 3;
    while (currentLine < lines.length && !lines[currentLine].startsWith('URI:')) {
      if (lines[currentLine]) {
        statement += (statement ? '\n' : '') + lines[currentLine];
      }
      currentLine++;
    }

    const extract = (prefix: string): string | undefined => {
      const line = lines.find(l => l.startsWith(prefix));
      return line?.slice(prefix.length).trim();
    };

    const nonce = extract('Nonce: ');
    const issuedAtStr = extract('Issued At: ');
    const expiresAtStr = extract('Expiration Time: ');
    const chainId = extract('Chain ID: ');

    if (!nonce || !issuedAtStr || !expiresAtStr) return null;

    const resources: string[] = [];
    const resourcesStart = lines.findIndex(l => l === 'Resources:');
    if (resourcesStart !== -1) {
      for (let i = resourcesStart + 1; i < lines.length; i++) {
        if (lines[i].startsWith('- ')) {
          resources.push(lines[i].slice(2));
        }
      }
    }

    return {
      domain,
      address,
      statement: statement || 'Sign this message to verify wallet ownership',
      nonce,
      issuedAt: new Date(issuedAtStr).getTime(),
      expiresAt: new Date(expiresAtStr).getTime(),
      chainId: chainId || 'minima:mainnet',
      resources: resources.length > 0 ? resources : undefined
    };
  } catch (error) {
    return null;
  }
}

export function digestChallenge(challenge: VerifyChallenge): { digest: Uint8Array; digestHex: string } {
  const builder = ChallengeBuilder.fromRequest(challenge);
  const serialized = builder.build();
  return {
    digest: serialized.digest,
    digestHex: serialized.digestHex
  };
}

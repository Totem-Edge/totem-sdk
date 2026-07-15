# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

To report a security vulnerability, please email:

**security@totem.ing**

Include as much detail as possible:
- A description of the vulnerability
- Steps to reproduce
- Affected package(s) and version(s)
- Any potential impact

We will acknowledge your report within 48 hours and provide a timeline for resolution within 5 business days.

### PGP Key

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
(Contact security@totem.ing for the current PGP key)
-----END PGP PUBLIC KEY BLOCK-----
```

## Disclosure Policy

1. The reporter will be acknowledged within 48 hours
2. We will investigate and confirm the vulnerability within 5 business days
3. A fix will be developed and tested
4. A security advisory will be published on GitHub
5. Credit will be given to the reporter (unless anonymity is requested)

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 2.x     | :white_check_mark: |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Security Model

Totem SDK is a quantum-resistant cryptographic platform. The security of the entire system depends on the following invariants:

### Critical Security Invariants

1. **WOTS Key Reuse Prevention**: No WOTS key index shall ever be used to sign more than one message. Violation of this invariant results in catastrophic security failure — private key recovery becomes computationally feasible. The `@totemsdk/wots-lease` package enforces this through lease/watermark coordination.

2. **Private Key Confinement**: Private keys and seed material must never leave the device. All signing operations happen client-side. The server only sees signed transactions.

3. **Byte-Exact Serialization**: All serialization must match the Minima Java node byte-for-byte. A single byte difference causes `allsignaturesvalid=false` and potential consensus failure.

### Cryptographic Policies

See [docs/security/crypto-policy.md](docs/security/crypto-policy.md) for detailed cryptographic security policies including:
- Key generation entropy requirements
- Secure memory handling
- Constant-time comparison requirements
- Side-channel attack mitigation
- Random number generation standards
- Dependency security
- Audit logging requirements
- Code review requirements for cryptographic code

## Bug Bounty

We offer bounties for responsibly disclosed vulnerabilities. Bounty amounts are determined by severity:

| Severity | Bounty Range |
|----------|-------------|
| Critical | $5,000 - $25,000 |
| High     | $1,000 - $5,000  |
| Medium   | $250 - $1,000    |
| Low      | $100 - $250      |

Critical vulnerabilities include:
- WOTS key recovery or signature forgery
- Private key extraction
- Seed phrase recovery from public data
- Consensus-breaking serialization bugs
- Remote code execution in wallet or node

## Security Contacts

- **Security Team**: security@totem.ing
- **PGP Key**: Available upon request
- **Response Time**: 48 hours acknowledgment, 5 business days initial assessment

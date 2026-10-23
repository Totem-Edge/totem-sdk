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

### Encrypted reports

If you need encrypted email, request the current PGP key from
**security@totem.ing** before sending details. Never send seed phrases, private
keys, or exploit details in plaintext.

## Published Advisories

- [Manifest author binding (2026-10)](docs/audits/manifest-author-binding-2026-10.md) —
  fixed in `@totemsdk/manifest` 2.0.2.

## Disclosure Policy

1. The reporter will be acknowledged within 48 hours
2. We will investigate and confirm the vulnerability within 5 business days
3. A fix will be developed and tested
4. A security advisory will be published on GitHub
5. Credit will be given to the reporter (unless anonymity is requested)

## Supported Versions

The SDK is pre-1.0 at the workspace level. Security fixes are applied to the
latest published release of each package; older releases are not supported.

| Package scope | Supported |
|---|---|
| Tier 0 production core | Yes |
| Tier 1 production candidates | Best effort; not production support |
| Tier 2 support dependencies and outside packages | Best effort; no production support |
| Older releases | No — upgrade to the latest release |

The per-package tiers are generated in [docs/maturity.md](docs/maturity.md) and
defined by [RFC-063](docs/rfc/RFC-063-PRODUCTION-READINESS-AND-MATURITY-PROMOTION.md).
Tier 1 packages are pre-release candidates, even when they are on `latest`.

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

We offer discretionary rewards for responsibly disclosed vulnerabilities.
Rewards are paid in `$TOTEM` tokens, not fiat. No fiat payment is offered or
implied.

The reference bands below size the token award. The token amount is calculated
at the initial valuation round price:

`token reward = reference USD value / initial round USD price per TOTEM`

| Severity | Reference band (USD) | Token reward |
|----------|---------------------:|--------------|
| Critical | $5,000 - $25,000 | equivalent in `$TOTEM` at the initial round price |
| High     | $1,000 - $5,000  | equivalent in `$TOTEM` at the initial round price |
| Medium   | $250 - $1,000    | equivalent in `$TOTEM` at the initial round price |
| Low      | $100 - $250      | equivalent in `$TOTEM` at the initial round price |

The exact `$TOTEM` amounts will be fixed when the initial valuation round price
is finalised. Until then, the reference bands are used only to size a
discretionary token award; they are not a promise of fiat payment.

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

# Security advisory process — RFC-063 B6

**Status:** active
**Owner:** Totem SDK maintainers
**Related:** [SECURITY.md](../../SECURITY.md), [threat model](threat-model.md),
[advisory index](advisories/README.md)

This document is the operational counterpart to `SECURITY.md`. It defines the
private reporting path, severity taxonomy, response targets, advisory format and
security changelog. `SECURITY.md` and every published advisory must agree with
it.

## 1. Private reporting path

1. **Primary:** GitHub private vulnerability reporting
   (`https://github.com/Totem-Edge/totem-sdk/security/advisories/new`). This
   creates a private advisory visible only to maintainers and the reporter.
2. **Email:** `security@totem.ing` for reporters who cannot use GitHub.
3. **Encrypted email:** request the current PGP key from `security@totem.ing`
   before sending sensitive details. Do not send seed phrases, private keys or
   exploit code in plaintext.
4. **Never** open a public issue, PR or discussion for an unfixed vulnerability.

Acknowledgement target: **48 hours**. Triage decision: **5 business days**.

## 2. Severity taxonomy

| Severity | Examples | Fix target | Advisory |
|---|---|---|---|
| **Critical** | WOTS leaf reuse or key extraction; signature/proof forgery; consensus or settlement divergence; remote code execution in a shipped package | 7 days | Yes, plus release notes |
| **High** | Authorization bypass; custody/liquidity-gate bypass; replay of a binding operation; durable-state corruption that can lose funds | 30 days | Yes |
| **Medium** | Denial of service with a bounded workaround; information disclosure without key material; policy/limits bypass without value loss | 90 days | Yes when user action is required |
| **Low** | Hardening, defence-in-depth, documentation or metadata defects | Next scheduled release | Optional |

CVSS may be recorded as supporting data, but the taxonomy above decides the
response target. A finding can be raised if exploitability is demonstrated even
when the CVSS score is lower.

## 3. Lifecycle

1. **Report** — private channel; assign an internal advisory ID
   (`TOTEM-YYYY-NNN`).
2. **Triage** — confirm affected packages and versions, reproduce, assign
   severity and an owner.
3. **Fix** — land the fix with a regression test; backport only where a supported
   release exists (`SECURITY.md` supported-versions table).
4. **Advisory** — draft in the private GitHub advisory, then publish and add it
   to [the advisory index](advisories/README.md).
5. **Release** — publish patched versions with provenance and a changelog entry.
6. **Disclose** — publish the advisory after patched versions are available;
   credit the reporter unless anonymity is requested.
7. **Review** — record the finding in the threat model or fuzz targets when it
   changes an invariant.

## 4. Advisory format

Every advisory carries:

- advisory ID, severity and publication date;
- affected package(s) and version range;
- fixed version(s);
- summary, impact and preconditions;
- workaround/mitigation if one exists;
- credit and disclosure timeline;
- links to the fix commit(s) and regression test.

Use [`advisories/TEMPLATE.md`](advisories/TEMPLATE.md). Do not publish an
advisory that claims a fix without a version and a test.

## 5. Security changelog

- Each package changelog records security fixes with the advisory ID.
- The advisory index is the authoritative list; the root `CHANGELOG.md` links to
  it.
- A fix without an advisory (Low severity) still gets a changelog line but need
  not add a GitHub advisory.

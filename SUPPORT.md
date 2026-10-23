# Support

## Support scope

Totem SDK is pre-release. Support follows the package tiers defined in
[RFC-063](docs/rfc/RFC-063-PRODUCTION-READINESS-AND-MATURITY-PROMOTION.md) and
generated in [docs/maturity.md](docs/maturity.md):

- **Tier 0 — Production core:** supported on a best-effort basis.
- **Tier 1 — Production candidates:** usable, but explicitly not production
  support while their evidence gates remain open.
- **Tier 2 — Required support dependencies:** maintained for the production
  core's dependency closure, not as standalone first-line support.
- **Outside the production surface:** no production support commitment.

There is currently no contractual SLA. The targets below are best-effort and
may change during the pre-release period.

## Getting help

### Documentation

- **API reference:** [https://totem.ing](https://totem.ing)
- **Core Yellow Paper:** [TOTEM_CORE_YELLOW_PAPER.md](TOTEM_CORE_YELLOW_PAPER.md)
- **Connect Red Paper:** [TOTEM_CONNECT_RED_PAPER.md](TOTEM_CONNECT_RED_PAPER.md)
- **Maturity matrix:** [docs/maturity.md](docs/maturity.md)

### Community

- **GitHub Discussions:** [https://github.com/Totem-Edge/totem-sdk/discussions](https://github.com/Totem-Edge/totem-sdk/discussions)
- **GitHub Issues:** [https://github.com/Totem-Edge/totem-sdk/issues](https://github.com/Totem-Edge/totem-sdk/issues)

### Direct contact

- **General inquiries:** hello@totem.ing
- **Security issues:** security@totem.ing — see [SECURITY.md](SECURITY.md)
- **Bug reports:** open a [GitHub Issue](https://github.com/Totem-Edge/totem-sdk/issues)

## Response targets

| Channel | Target |
|---|---|
| GitHub Issues | Best effort, usually within 2–3 business days |
| GitHub Discussions | Best effort, usually within 2–3 business days |
| Email (general) | Best effort, usually within 1–2 business days |
| Security reports | 48 hours acknowledgment |

These are targets, not guarantees. Security reports follow the process and
disclosure policy in [SECURITY.md](SECURITY.md).

## Frequently asked questions

### How do I install the SDK?

```bash
pnpm add @totemsdk/core
```

Tier 1 packages should be installed with their explicit channel, for example:

```bash
pnpm add @totemsdk/omnia@next
```

### How do I create a wallet?

See the [Quick Start](README.md#quick-start) section in the README.

### How do I integrate my dApp with Totem Wallet?

See the [Connect Red Paper](TOTEM_CONNECT_RED_PAPER.md).

### How do I report a security vulnerability?

See [SECURITY.md](SECURITY.md). Do not open a public issue.

### How do I contribute?

See [CONTRIBUTING.md](CONTRIBUTING.md).

### Where can I find the API reference?

Visit [https://totem.ing](https://totem.ing) for the complete API reference.

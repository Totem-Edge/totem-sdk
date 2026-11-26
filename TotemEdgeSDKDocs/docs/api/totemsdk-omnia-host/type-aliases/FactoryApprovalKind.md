[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / FactoryApprovalKind

# Type Alias: FactoryApprovalKind

> **FactoryApprovalKind** = `"open"` \| `"close"`

Authorization gate for peer-initiated factory signing.

Cryptographic validity is not authorization: a peer can present a correctly
formed opening or close that this host never agreed to fund. Every signature
request from a peer therefore passes through this gate before a WOTS leaf is
reserved. The default is deny; unattended hosts opt into a bounded automated
policy explicitly (max total value and/or an allowlist of peer keys).

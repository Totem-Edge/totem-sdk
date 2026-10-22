# @totemsdk/entity

Disclosure-bounded entity resolution and projection for the Totem SDK (RFC-056).

An **entity** is a resolved cryptographic actor: a root identity, optionally a
semantic identity document, manifests, claims, ownership proofs and authority
grants. A **projection** is a privacy-bounded output for one interaction.

```ts
import { resolveEntity, projectEntity } from '@totemsdk/entity';
import { createRootIdentityProofVerifier } from '@totemsdk/root-identity';

const resolution = await resolveEntity(
  {
    identity: identityGraph,
    manifest: signedManifest,
    rootIdentityProof,
    authority: grantsVerifiedByAuthority,
  },
  {
    asOf: Date.now(),
    proofVerifier: createRootIdentityProofVerifier(),
  },
);

const view = projectEntity(resolution, {
  mode: 'purpose-bound',
  purposes: ['capabilities'],
});

// root + manifest only; identity, claims, children and authority are withheld.
```

## Guarantees

- **Disclosure-bounded:** absence of disclosure is `unknown`, never `invalid`
  and never `false`.
- **Root is the privacy floor:** a minimal view contains only the root address
  and an opaque `entityRef`.
- **No invented data:** a section is disclosed only when it was supplied and
  verified.
- **Explicit time:** every resolution and view carries `asOf`; projections must
  match the resolution time.
- **No hidden authority:** root ancestry is evidence only. `@totemsdk/entity`
  never grants `manifest:sign`, mandates or governance rights.

## Sections and levels

| Level | Section | Meaning |
|---|---|---|
| 0 | `root` | same cryptographic actor |
| 1 | `children` | these addresses share a root |
| 2 | `identity` | semantic Totem identity |
| 3 | `manifest` | I provide these capabilities |
| 4 | `claims` | I possess X / own Y / satisfy Z |
| 5 | `authority` | I may perform Q |

## Modes

- `minimal` (default): root only.
- `available`: every verified section up to `maxDisclosureLevel`.
- `purpose-bound`: only the sections required by the requested purposes.

## What it does not do

No network/DHT resolution, signing, key custody, authority verification, policy
evaluation, persistence or chain anchoring. Authority grants must already be
verified by `@totemsdk/authority`; root proofs are verified through an injected
verifier so this package does not depend on the wallet.

See `docs/rfc/RFC-056-ENTITY-PROJECTION.md` for the normative design.

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

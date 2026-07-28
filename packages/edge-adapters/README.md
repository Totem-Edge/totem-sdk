# @totemsdk/edge-adapters

Reference adapters bridging Totem SDK packages to `@totemsdk/edge` port interfaces.

## What it does

Wires the Totem SDK into Edge's composable port-based runtime. Each adapter is a factory function that takes SDK dependencies and returns an object implementing the corresponding Edge port interface.

## Adapters

| Adapter | Port Interface | SDK Dependency |
|---------|---------------|----------------|
| `createLiquidityPortAdapter` | `EdgeLiquidityPort` | `@totemsdk/chain-provider` |
| `createProofPortAdapter` | `EdgeProofPort` | `@totemsdk/proof` |
| `createLookupPortAdapter` | `EdgeLookupPort` | `@totemsdk/lookup-client` |
| `createPolicyPortAdapter` | `EdgePolicyPort` | `@totemsdk/agent-policy` |
| `createIdentityPortAdapter` | `EdgeIdentityPort` | `@totemsdk/identity` |
| `createManifestPortAdapter` | `EdgeManifestPort` | `@totemsdk/manifest` |
| `createMinimaL1PaymentPort` | `EdgePaymentPort` | `@totemsdk/root-identity` |
| `createOmniaL2PaymentPort` | `EdgePaymentPort` | `@totemsdk/omnia-router` |

## Installation

```bash
npm install @totemsdk/edge-adapters
```

All SDK dependencies are optional peer dependencies — install only the ones you need for the adapters you use.

## Usage

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createLiquidityPortAdapter, createProofPortAdapter } from '@totemsdk/edge-adapters';
import { HostedProvider } from '@totemsdk/chain-provider';
import { createProof, signProof } from '@totemsdk/proof';

const chainProvider = new HostedProvider({ baseUrl: 'https://api.axia.to', apiKey: '...' });

const liquidityPort = createLiquidityPortAdapter({ chainProvider });
const proofPort = createProofPortAdapter({ createProof, signProof });

const device = createEdgeDevice({ deviceId: 'my-device' });
const capabilities = createCapabilitySet(['payment:send', 'proof:create']);
const runtime = createEdgeRuntime({ device, capabilities, ports: { liquidityPort, proofPort } });
```

## Out of scope

- Implementing port interfaces — those are defined in `@totemsdk/edge`
- Implementing SDK functionality — each adapter delegates to the corresponding SDK package
- Transport/networking — adapters are transport-agnostic

## License

MIT

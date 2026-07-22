# @totemsdk/governance

**On-chain governance for Minima: quadratic voting, liquid democracy, and delegation.**

Built on KISSVM — all policies compile to Minima-compatible scripts with MAST proofs.

**Status: v0.1 — experimental, not audited.**

## Modules

| Module | Description |
|--------|-------------|
| `quadratic-voting` | Quadratic cost (votes²), credit pool accounting, sqrt-weighted tally |
| `liquid-democracy` | Delegation chain resolution (max depth), direct-vote override, scope filtering |
| `delegation` | Partial/full weight, multi-hop delegation with cycle prevention, recall |
| `mandate-bridge` | Produces `@totemsdk/authority`-compatible `MandateBody` (6 field constraints) |

## Install

```bash
npm install @totemsdk/governance
```

## Quick start

```ts
import { tallyQuadraticVotes, type VoteCredits } from '@totemsdk/governance';

const credits: VoteCredits = [
  { voterId: '0xABC', voteWeight: 1n, creditBalance: 100n },
  { voterId: '0xDEF', voteWeight: 1n, creditBalance: 50n },
];
const result = tallyQuadraticVotes(credits);
// result = { voterId: '0xABC', cost: 1n, remainingCredits: 99n }
```

## License

MIT

---
id: kissvm-studio
title: KISSVM Studio
sidebar_label: KISSVM Studio
description: Local developer IDE for writing and simulating KISSVM scripts with a policy safety linter.
---

# KISSVM Studio

**Type:** Developer tooling  
**Audience:** Smart contract developers, Minima dApp builders, security researchers

KISSVM Studio is a browser-based IDE for authoring, simulating, and testing KISSVM scripts — Minima's on-chain scripting language. An `agent-policy` evaluator acts as a **safety linter**: before any script is broadcast to the chain, the policy checks for common pitfalls (unbounded loops, missing state guards, suspicious coin drains) and either auto-approves, warns, or blocks the deployment.

---

## Packages used

| Package | Role in KISSVM Studio |
|---------|----------------------|
| `@totemsdk/kissvm` | Lexer, parser, AST, and evaluator for KISSVM scripts |
| `@totemsdk/agent-policy` | Safety linter — evaluates scripts before on-chain deployment |
| `@totemsdk/tx-builder` | Wraps a script in a deployable transaction envelope |
| `@totemsdk/chain-provider` | Submits deploy transactions to a local dev node |
| `@totemsdk/pureminima-rpc` | Fetches chain state for simulation context |
| `@totemsdk/connect` | Connects to the developer's Totem wallet for signing |

---

## Core integration path

### 1. Parse and display a KISSVM script

```typescript
import { lex, parse, type ASTNode } from '@totemsdk/kissvm';

const source = `
LET x = STATE 1
IF x GT 0 THEN
  RETURN TRUE
ENDIF
RETURN FALSE
`;

const tokens = lex(source);
const ast: ASTNode = parse(tokens);

// Render the AST in the editor sidebar
renderASTExplorer(ast);
```

### 2. Simulate against chain state

```typescript
import { evaluate } from '@totemsdk/kissvm';
import { PureMinimaRPC } from '@totemsdk/pureminima-rpc';

const rpc = new PureMinimaRPC({ url: 'http://localhost:9002' });
const chainState = await rpc.getChainState();

const result = await evaluate(ast, {
  state: { 1: '42' },     // mock state variables
  inputs: [],
  outputs: [],
  chainHeight: chainState.topblock,
});

console.log('Simulation result:', result); // true | false | Error
```

### 3. Policy linter before deployment

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';
import { analyse } from '@totemsdk/kissvm';

const linterPolicy: AgentPolicy = {
  async evaluate(proposal: AgentProposal) {
    if (proposal.intent.type !== 'script_deploy') {
      return { outcome: 'rejected', reason: 'Only script_deploy intents accepted' };
    }

    const { source } = proposal.intent;
    const analysis = analyse(source);

    const criticalIssues = analysis.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      return {
        outcome: 'rejected',
        reason: `Script has ${criticalIssues.length} critical issue(s): ${criticalIssues.map(i => i.message).join(', ')}`,
      };
    }

    const warnings = analysis.issues.filter(i => i.severity === 'warning');
    if (warnings.length > 0) {
      return {
        outcome: 'requires_human',
        prompt: `Script has ${warnings.length} warning(s). Review before deploying?`,
      };
    }

    return {
      outcome: 'approved',
      receipt: buildReceipt(proposal, 'linter-v1'),
    };
  },
};
```

### 4. Deploy the script

```typescript
import { buildScriptDeployTx } from '@totemsdk/tx-builder';
import { connect } from '@totemsdk/connect';
import { getChainProvider } from '@totemsdk/chain-provider';

const { address } = await connect(location.origin);
const provider = getChainProvider({ nodeUrl: DEV_NODE_URL });

async function deployScript(source: string) {
  const proposal = {
    id: crypto.randomUUID(),
    intent: { type: 'script_deploy' as const, source, author: address },
    requestedBy: { id: 'kissvm-studio', type: 'app' as const },
    createdAt: Date.now(),
  };

  const decision = await linterPolicy.evaluate(proposal);
  if (decision.outcome !== 'approved') {
    if (decision.outcome === 'requires_human') showWarningDialog(decision.prompt);
    else throw new Error(decision.reason);
  }

  const tx = await buildScriptDeployTx({ source, signer: address });
  return provider.submit(tx);
}
```

---

## Future QVAC hook

:::tip Future QVAC hook
A QVAC agent can auto-generate KISSVM scripts from natural-language specs, run the linter policy, iterate on failures, and only surface the approved script to the developer for a final human sign-off. The `linterPolicy` is the gate between AI generation and on-chain deployment.
:::

---

## API reference links

- [`@totemsdk/kissvm`](/api/totemsdk-kissvm)
- [`@totemsdk/agent-policy`](/api/totemsdk-agent-policy)
- [`@totemsdk/tx-builder`](/api/totemsdk-tx-builder)
- [`@totemsdk/chain-provider`](/api/totemsdk-chain-provider)
- [`@totemsdk/pureminima-rpc`](/api/totemsdk-pureminima-rpc)
- [`@totemsdk/connect`](/api/totemsdk-connect)

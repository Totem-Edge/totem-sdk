import { createIdentityPortAdapter } from '../identity';
import { createIdentityDocument } from '@totemsdk/identity';
import type { IdentityGraph } from '@totemsdk/identity';

function makeGraph(rootAddress = 'MxROOT'): IdentityGraph {
  return {
    document: createIdentityDocument({ kind: 'device', rootAddress, controllerAddress: rootAddress }),
    claims: [],
  };
}

describe('createIdentityPortAdapter — resolve', () => {
  it('resolves the identity when the ID matches', async () => {
    const graph = makeGraph();
    const port = createIdentityPortAdapter({ graph });
    const result = await port.resolve(graph.document.id);
    expect(result.ok).toBe(true);
    expect(result.data?.identity).toBeDefined();
  });

  it('returns ok:false for an unknown identity ID', async () => {
    const graph = makeGraph();
    const port = createIdentityPortAdapter({ graph });
    const result = await port.resolve('totem:id:device:unknown');
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('IDENTITY_NOT_FOUND');
  });

  it('resolved identity has active status for empty claim set', async () => {
    const graph = makeGraph();
    const port = createIdentityPortAdapter({ graph });
    const result = await port.resolve(graph.document.id);
    const identity = result.data?.identity as { status?: string };
    expect(identity.status).toBe('active');
  });
});

describe('createIdentityPortAdapter — verify', () => {
  it('returns ok:false for non-SignedIdentityClaim proof', async () => {
    const port = createIdentityPortAdapter({ graph: makeGraph() });
    const result = await port.verify({ kind: 'unknown-proof-type' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('UNSUPPORTED_PROOF_TYPE');
  });

  it('returns ok:false for null proof', async () => {
    const port = createIdentityPortAdapter({ graph: makeGraph() });
    const result = await port.verify(null);
    expect(result.ok).toBe(false);
  });
});

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { ChannelGraphEdge, CrossTokenRoute, Route } from '@totemsdk/omnia-router';
import type { RouteQuery, RoutingProvider } from './routing-provider.js';

interface GoResponse {
  result?: Route | CrossTokenRoute | { ok: boolean } | null;
  error?: string;
}

/** Optional phase-10 provider for a compiled Go router speaking JSONL over stdio. */
export class GoRoutingProvider implements RoutingProvider {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, { resolve: (value: GoResponse) => void; reject: (error: Error) => void }>();
  private nextId = 1;

  constructor(binaryPath = 'omnia-router') {
    this.child = spawn(binaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = createInterface({ input: this.child.stdout });
    lines.on('line', (line) => {
      try {
        const response = JSON.parse(line) as GoResponse & { id?: number };
        const pending = response.id === undefined ? undefined : this.pending.get(response.id);
        if (!pending || response.id === undefined) return;
        this.pending.delete(response.id);
        pending.resolve(response);
      } catch (error) {
        for (const pending of this.pending.values()) pending.reject(error as Error);
        this.pending.clear();
      }
    });
    const fail = (error: Error) => {
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    };
    this.child.once('error', fail);
    this.child.once('exit', (code) => fail(new Error(`Go router exited with code ${code ?? 'unknown'}`)));
  }

  rebuild(edges: Iterable<ChannelGraphEdge>): void {
    for (const edge of edges) {
      void this.call('addChannel', edge as unknown as Record<string, unknown>);
    }
  }

  async getRoute(query: RouteQuery): Promise<Route | CrossTokenRoute | null> {
    const response = await this.call('findRoute', {
      from: query.from,
      to: query.to,
      amount: query.amount.toString(),
      tokenId: query.tokenId,
      maxHops: query.maxHops,
    });
    if (response.error) throw new Error(response.error);
    return (response.result as Route | CrossTokenRoute | null | undefined) ?? null;
  }

  close(): void {
    this.child.stdin.end();
    this.child.kill();
  }

  private call(method: string, params: Record<string, unknown>): Promise<GoResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }
}

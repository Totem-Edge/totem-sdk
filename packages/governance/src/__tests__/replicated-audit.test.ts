import { ReplicatedGovernanceAudit } from '../replicated-audit.js';

describe('replicated governance audit', () => {
  it('replays the governance timeline', async () => {
    const records: any[] = [];
    const log = {
      async append(r: any) { records.push(r); return { length: records.length, head: `h:${records.length}` }; },
      async *readSince() { for (let i = 0; i < records.length; i += 1) yield { cursor: `h:${i + 1}`, record: records[i] }; },
      status: () => ({ connectedPeers: 0, localHead: null, observedHeads: [], syncing: false }),
      async close() {},
    };
    const audit = new ReplicatedGovernanceAudit(log as never);
    await audit.append({ kind: 'proposal', proposal: { id: 'p1' } as never });
    const seen: string[] = [];
    for await (const e of audit.readSince()) seen.push(e.record.kind);
    expect(seen).toEqual(['proposal']);
  });
});

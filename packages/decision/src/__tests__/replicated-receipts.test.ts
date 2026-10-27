import { ReplicatedDecisionReceiptLog } from '../replicated-receipts.js';

describe('replicated decision receipts', () => {
  it('appends and replays decision refs', async () => {
    const records: any[] = [];
    const log = {
      async append(r: any) { records.push(r); return { length: records.length, head: `h:${records.length}` }; },
      async *readSince() { for (let i = 0; i < records.length; i += 1) yield { cursor: `h:${i + 1}`, record: records[i] }; },
      status: () => ({ connectedPeers: 0, localHead: null, observedHeads: [], syncing: false }),
      async close() {},
    };
    const replica = new ReplicatedDecisionReceiptLog(log as never);
    await replica.append({
      kind: 'decision', receiptId: 'r1', decisionKind: 'action', providerId: 'p1',
      issuedAt: 1, requestDigest: 'd1', stateDigest: 's1', candidateSetDigest: 'c1',
      outputDigest: 'o1', verification: 'verified',
    });
    const seen: string[] = [];
    for await (const e of replica.readSince()) seen.push(e.record.receiptId);
    expect(seen).toEqual(['r1']);
  });
});

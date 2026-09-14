/**
 * API drift snapshots for @totemsdk/qvac.
 */

import { QVAC_API_SNAPSHOT, QVAC_API_OP_COUNT, QVAC_API_STREAM_OPS } from '../api-snapshot.js';
import { INTELLIGENCE_OPS } from '@totemsdk/intelligence';

describe('QVAC API snapshot', () => {
  it('catalogs the full 0.19.0 operation surface', () => {
    expect(QVAC_API_OP_COUNT).toBe(54);
  });

  it('marks stream-capable ops', () => {
    expect(QVAC_API_STREAM_OPS).toContain('transcribeStream');
    expect(QVAC_API_STREAM_OPS).toContain('bciTranscribeStream');
    expect(QVAC_API_STREAM_OPS).toContain('textToSpeechStream');
    expect(QVAC_API_STREAM_OPS).toContain('invokePluginStream');
  });

  it('maps every snapshot op into a provider domain', () => {
    const domains = new Set(QVAC_API_SNAPSHOT.ops.map(o => o.domain));
    expect(domains).toContain('llm');
    expect(domains).toContain('rag');
    expect(domains).toContain('asr');
  });

  it('does not drift from the well-known op catalog', () => {
    const canonical = new Set<string>();
    for (const ops of Object.values(INTELLIGENCE_OPS)) {
      for (const op of ops) canonical.add(op);
    }
    for (const entry of QVAC_API_SNAPSHOT.ops) {
      expect(canonical.has(entry.op)).toBe(true);
    }
  });
});
import { formatVersionLine } from '../src/shared/apiVersion';

describe('formatVersionLine', () => {
  it('shows the API and bootstrap schema versions together', () => {
    expect(formatVersionLine({ api: '1.1.2', schema: '1.0.0' }))
      .toBe('API 1.1.2 · config schema 1.0.0');
  });

  it('degrades to unknown instead of throwing', () => {
    expect(formatVersionLine({ api: '', schema: '' }))
      .toBe('API unknown · config schema unknown');
  });
});

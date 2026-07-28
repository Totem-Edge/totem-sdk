import { matchScope, matchConstraints } from '../scope.js';
import type { ActionIntent, MandateConstraint } from '../types.js';

function mc(list: MandateConstraint[]): MandateConstraint[] {
  return list;
}

describe('matchScope', () => {
  it('wildcard matches everything', () => {
    expect(matchScope('anything', '*')).toBe(true);
    expect(matchScope('data:read', '*')).toBe(true);
    expect(matchScope('a:b:c:d', '*')).toBe(true);
  });

  it('exact string matches', () => {
    expect(matchScope('data:read', 'data:read')).toBe(true);
    expect(matchScope('manifest:sign', 'manifest:sign')).toBe(true);
  });

  it('rejects different actions', () => {
    expect(matchScope('data:read', 'data:write')).toBe(false);
    expect(matchScope('manifest:sign', 'manifest:verify')).toBe(false);
  });

  it('segment-level wildcard matches remaining parts', () => {
    expect(matchScope('data:read:records', 'data:*')).toBe(true);
    expect(matchScope('data:read:records:all', 'data:*')).toBe(true);
  });

  it('segment-level wildcard does not over-match when action has fewer parts', () => {
    expect(matchScope('data', 'data:read')).toBe(false);
  });

  it('rejects when prefix differs', () => {
    expect(matchScope('manifest:sign', 'data:read')).toBe(false);
  });

  it('matches with wildcard at exact depth', () => {
    expect(matchScope('data:read', 'data:*')).toBe(true);
  });

  it('scope wildcard only in middle segment', () => {
    expect(matchScope('system:admin:config', 'system:*:config')).toBe(true);
    expect(matchScope('system:user:config', 'system:*:config')).toBe(true);
    expect(matchScope('system:admin:other', 'system:*:config')).toBe(false);
  });
});

describe('matchConstraints', () => {
  const baseAction: ActionIntent = {
    action: 'data:read',
    principal: 'p',
    agent: 'MxAGENT',
    constraints: { region: 'us-east', limit: 100, tags: ['prod', 'staging'] },
  };

  it('passes when all constraints match', () => {
    const constraints: MandateConstraint[] = [
      { field: 'region', operator: 'eq', value: 'us-east' },
      { field: 'limit', operator: 'lte', value: 200 },
    ];
    expect(matchConstraints(baseAction, constraints)).toBe(true);
  });

  it('fails when a constraint field is missing from the action', () => {
    const constraints: MandateConstraint[] = [
      { field: 'nonexistent', operator: 'eq', value: 'x' },
    ];
    expect(matchConstraints(baseAction, constraints)).toBe(false);
  });

  it('fails on eq mismatch', () => {
    const constraints: MandateConstraint[] = [
      { field: 'region', operator: 'eq', value: 'eu-west' },
    ];
    expect(matchConstraints(baseAction, constraints)).toBe(false);
  });

  it('lt works correctly', () => {
    const pass = mc([{ field: 'limit', operator: 'lt', value: 200 }]);
    const fail = mc([{ field: 'limit', operator: 'lt', value: 50 }]);
    expect(matchConstraints(baseAction, pass)).toBe(true);
    expect(matchConstraints(baseAction, fail)).toBe(false);
  });

  it('lte works correctly', () => {
    const pass = mc([{ field: 'limit', operator: 'lte', value: 100 }]);
    const fail = mc([{ field: 'limit', operator: 'lte', value: 99 }]);
    expect(matchConstraints(baseAction, pass)).toBe(true);
    expect(matchConstraints(baseAction, fail)).toBe(false);
  });

  it('gt works correctly', () => {
    const pass = mc([{ field: 'limit', operator: 'gt', value: 50 }]);
    const fail = mc([{ field: 'limit', operator: 'gt', value: 200 }]);
    expect(matchConstraints(baseAction, pass)).toBe(true);
    expect(matchConstraints(baseAction, fail)).toBe(false);
  });

  it('gte works correctly', () => {
    const pass = mc([{ field: 'limit', operator: 'gte', value: 100 }]);
    const fail = mc([{ field: 'limit', operator: 'gte', value: 101 }]);
    expect(matchConstraints(baseAction, pass)).toBe(true);
    expect(matchConstraints(baseAction, fail)).toBe(false);
  });

  it('in works correctly', () => {
    const pass = mc([{ field: 'tags', operator: 'in', value: ['prod'] }]);
    const fail = mc([{ field: 'tags', operator: 'in', value: ['dev'] }]);
    expect(matchConstraints(baseAction, pass)).toBe(true);
    expect(matchConstraints(baseAction, fail)).toBe(false);
  });

  it('not_in works correctly', () => {
    const pass = mc([{ field: 'tags', operator: 'not_in', value: ['dev'] }]);
    const fail = mc([{ field: 'tags', operator: 'not_in', value: ['prod'] }]);
    expect(matchConstraints(baseAction, pass)).toBe(true);
    expect(matchConstraints(baseAction, fail)).toBe(false);
  });

  it('empty constraints always pass', () => {
    expect(matchConstraints(baseAction, [])).toBe(true);
  });
});

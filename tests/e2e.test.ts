import { describe, expect, it } from 'vitest';
import {
  getFixtureFile,
  modes,
  plainOptions,
  stripTermEsc
} from './helpers.ts';

describe.each(modes)('e2e ($name)', ({ render }) => {
  it('should render a document full of different supported syntax', () => {
    const actual = stripTermEsc(render(getFixtureFile('e2e.md'), plainOptions));
    expect(actual).toBe(getFixtureFile('e2e.result.txt'));
  });
});

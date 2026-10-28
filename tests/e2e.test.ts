import { describe, expect, it } from 'vitest';
import {
  getFixtureFile,
  plainOptions,
  render,
  stripTermEsc
} from './helpers.ts';

describe('e2e', () => {
  it('should render a document full of different supported syntax', () => {
    const actual = stripTermEsc(render(getFixtureFile('e2e.md'), plainOptions));
    expect(actual).toBe(getFixtureFile('e2e.result.txt'));
  });
});

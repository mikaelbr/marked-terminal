import { describe, expect, it } from 'vitest';
import TerminalRenderer from '../index.js';

describe('Terminal escape', () => {
  const r = new TerminalRenderer();

  it.each([
    '\u001b[38;5;128mfoo\u001b[0m',
    '\u001b[33mfoo\u001b[22m\u001b[24m\u001b[39m',
    '\u001b[35m\u001b[4m\u001b[1mfoo',
    '\u001b[33mfo\u001b[39mo\u001b[0m',
    '\u001b]8;;http://example.com\u0007foo\u001b]8;;\u0007'
  ])('should not be included in text length: %j', (token) => {
    expect(r.textLength(token)).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import { render, stripTermEsc } from './helpers.ts';

describe('Terminal escape', () => {
  it.each([
    ['\u001b[38;5;128m', '\u001b[0m'],
    ['\u001b[33m', '\u001b[22m\u001b[24m\u001b[39m'],
    ['\u001b[35m\u001b[4m\u001b[1m', '']
  ])('should not count %j in reflow width', (open, close) => {
    const output = render('foo **bar** baz', {
      strong: (s) => `${open}${s}${close}`,
      reflowText: true,
      width: 7
    });
    expect(stripTermEsc(output)).toBe('foo bar\nbaz\n\n');
  });
});

import { describe, expect, it } from 'vitest';
import type { TerminalRendererOptions } from '../src/index.ts';
import { plainOptions, render, stripTermEsc } from './helpers.ts';

// https://github.com/mikaelbr/marked-terminal/issues/272
const reflowOptions: TerminalRendererOptions = {
  ...plainOptions,
  reflowText: true,
  width: 30
};

const markup = (str: string) => stripTermEsc(render(str, reflowOptions));

describe('Reflow text in lists', () => {
  it('should reflow unordered list items with a hanging indent', () => {
    expect(markup('* A single unordered line that continues here')).toBe(
      '    * A single unordered line\n      that continues here\n\n'
    );
  });

  it('should reflow ordered list items with a hanging indent', () => {
    expect(markup('1. A single ordered line that continues here')).toBe(
      '    1. A single ordered line\n       that continues here\n\n'
    );
  });

  it('should reflow loose list items within width', () => {
    expect(
      markup('* A single unordered line that continues here\n\n* second')
    ).toBe(
      '    * A single unordered line\n      that continues here\n    * second\n\n'
    );
  });

  it('should reflow nested list items with a hanging indent', () => {
    expect(
      markup(
        '* outer item with quite long text here\n    * nested item with quite long text here'
      )
    ).toBe(
      '    * outer item with quite\n      long text here\n' +
        '        * nested item with\n          quite long text here\n\n'
    );
  });
});

describe('Ordered list numbering', () => {
  const plain = (str: string) => stripTermEsc(render(str, plainOptions));

  it('should align item text to the widest number', () => {
    const items = Array.from({ length: 10 }, (_, i) => `${i + 1}. item`);
    const lines = plain(items.join('\n')).split('\n');
    expect(lines[0]).toBe('    1.  item');
    expect(lines[9]).toBe('    10. item');
  });

  it('should align wrapped text to the widest number', () => {
    const items = Array.from({ length: 10 }, (_, i) => `${i + 1}. item`);
    items[0] = '1. A single ordered line that continues here';
    expect(markup(items.join('\n')).split('\n').slice(0, 2)).toEqual([
      '    1.  A single ordered line',
      '        that continues here'
    ]);
  });

  it('should not count nested list items', () => {
    expect(plain('1. a\n    1. b\n    2. c\n2. d')).toBe(
      '    1. a\n        1. b\n        2. c\n    2. d\n\n'
    );
  });
});

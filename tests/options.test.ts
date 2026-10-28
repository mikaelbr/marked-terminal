import { describe, expect, it } from 'vitest';
import {
  modes,
  plainOptions,
  type TerminalRendererOptions
} from './helpers.ts';

const options: TerminalRendererOptions = { ...plainOptions, emoji: false };

describe.each(modes)('Options ($name)', ({ render }) => {
  it('should not translate emojis', () => {
    expect(render('Some :emoji:', options)).toContain(':emoji:');
  });

  it.each([
    ['change tabs by space size', 4, '    '],
    [
      'use default tabs if passing not supported string',
      'dsakdskajhdsa',
      '    '
    ],
    ['change tabs by allowed characters', '\t', '\t'],
    ['support multiple tab characters', '\t\t', '\t\t']
  ])('should %s', (_, tab, indent) => {
    expect(render('> Blockquote', { ...options, tab })).toBe(
      `${indent}Blockquote\n\n`
    );
    expect(render('* List Item', { ...options, tab })).toBe(
      `${indent}* List Item\n\n`
    );
  });

  it('should support overriding image handling', () => {
    const text = '\n# Title\n![Alt text](./img.jpg)';
    expect(render(text, { ...options, image: () => 'IMAGE' })).toBe(
      '# Title\n\nIMAGE\n\n'
    );
  });

  it('should pass href, title and text to image handler', () => {
    const calls: unknown[][] = [];
    render('![Alt](./img.jpg "Title")', {
      ...options,
      image: (...args) => {
        calls.push(args);
        return '';
      }
    });
    expect(calls).toEqual([['./img.jpg', 'Title', 'Alt']]);
  });
});

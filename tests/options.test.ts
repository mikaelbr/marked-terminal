import { describe, expect, it } from 'vitest';
import type { TerminalRendererOptions } from '../src/index.ts';
import { plainOptions, render } from './helpers.ts';

const options: TerminalRendererOptions = { ...plainOptions, emoji: false };

describe('Options', () => {
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
    expect(render('* List Item\n    * Nested', { ...options, tab })).toBe(
      `* List Item\n${indent}* Nested\n\n`
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

  describe('hyperlinks', () => {
    const link = '[Github](https://github.com)';

    it('should render text and url when disabled', () => {
      expect(render(link, { ...options, hyperlinks: false })).toBe(
        'Github (https://github.com)\n\n'
      );
    });

    it('should render a terminal hyperlink when enabled', () => {
      expect(render(link, { ...options, hyperlinks: true })).toBe(
        '\u001B]8;;https://github.com\u0007Github\u001B]8;;\u0007\n\n'
      );
    });

    it('should render the url as link text when there is no text', () => {
      expect(
        render('<https://github.com>', { ...options, hyperlinks: true })
      ).toBe(
        '\u001B]8;;https://github.com\u0007https://github.com\u001B]8;;\u0007\n\n'
      );
      expect(
        render('<https://github.com>', { ...options, hyperlinks: false })
      ).toBe('https://github.com\n\n');
    });

    it('should detect support from stdout when not set', async () => {
      const { default: supportsHyperlinks } = await import(
        'supports-hyperlinks'
      );
      const expected = render(link, {
        ...options,
        hyperlinks: supportsHyperlinks.stdout
      });
      expect(render(link, options)).toBe(expected);
      expect(render(link, { ...options, hyperlinks: undefined })).toBe(
        expected
      );
    });
  });
});

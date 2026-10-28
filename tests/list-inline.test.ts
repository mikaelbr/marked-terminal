import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TerminalRendererOptions } from '../src/index.ts';
import { identity, render, stripTermEsc } from './helpers.ts';

const debugOptions: TerminalRendererOptions = {
  strong: (text) => `[STRONG:${text}]`,
  em: (text) => `[EM:${text}]`,
  codespan: (text) => `[CODE:${text}]`,
  del: (text) => `[DEL:${text}]`,
  listitem: identity
};

const markup = (str: string) => stripTermEsc(render(str, debugOptions));

describe('Inline formatting in lists', () => {
  it('should render bold text in list items', () => {
    expect(markup('1. **bold text** in list')).toBe(
      '    1. [STRONG:bold text] in list\n\n'
    );
  });

  it('should render italic text in list items', () => {
    expect(markup('* _italic text_ in list')).toBe(
      '    * [EM:italic text] in list\n\n'
    );
  });

  it('should render code spans in list items', () => {
    expect(markup('* `code` in list')).toBe('    * [CODE:code] in list\n\n');
  });

  it('should render strikethrough in list items', () => {
    expect(markup('- ~~deleted text~~ in list')).toBe(
      '    * [DEL:deleted text] in list\n\n'
    );
  });

  it('should render mixed inline formatting in list items', () => {
    expect(markup('1. **bold** _italic_ `code` ~~strike~~')).toBe(
      '    1. [STRONG:bold] [EM:italic] [CODE:code] [DEL:strike]\n\n'
    );
  });

  it('should render inline formatting in multiple list items', () => {
    expect(markup('1. **first** item\n2. _second_ item\n3. `third` item')).toBe(
      '    1. [STRONG:first] item\n    2. [EM:second] item\n    3. [CODE:third] item\n\n'
    );
  });

  it('should render inline formatting in nested list items', () => {
    expect(markup('* **outer**\n    * _inner_')).toBe(
      '    * [STRONG:outer]\n        * [EM:inner]\n\n'
    );
  });

  it('should preserve plain text list items', () => {
    expect(markup('1. plain text\n2. more plain text')).toBe(
      '    1. plain text\n    2. more plain text\n\n'
    );
  });
});

describe('Nested lists with colors', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should not add blank lines between deeply nested items', () => {
    vi.stubEnv('FORCE_COLOR', '1');
    expect(
      stripTermEsc(render('* a\n    * b\n        * c\n        * d\n    * e'))
    ).toBe(
      '    * a\n        * b\n            * c\n            * d\n        * e\n\n'
    );
  });
});

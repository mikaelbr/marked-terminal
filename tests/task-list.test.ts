import { describe, expect, it } from 'vitest';
import type { TerminalRendererOptions } from '../src/index.ts';
import { plainOptions, render, stripTermEsc } from './helpers.ts';

const markup = (str: string, options?: TerminalRendererOptions, gfm = true) =>
  stripTermEsc(render(str, { ...plainOptions, ...options }, { gfm }));

describe('Task lists', () => {
  it('should render an unchecked task item once', () => {
    expect(markup('* [ ] task item')).toBe('    * [ ] task item\n\n');
  });

  it('should render a checked task item once', () => {
    expect(markup('* [x] done')).toBe('    * [X] done\n\n');
    expect(markup('* [X] done')).toBe('    * [X] done\n\n');
  });

  it('should render ordered task items', () => {
    expect(markup('1. [x] done\n2. [ ] todo')).toBe(
      '    1. [X] done\n    2. [ ] todo\n\n'
    );
  });

  it('should render task and plain items in the same list', () => {
    expect(markup('* [ ] todo\n* plain\n* [x] done')).toBe(
      '    * [ ] todo\n    * plain\n    * [X] done\n\n'
    );
  });

  it('should render nested task items', () => {
    expect(markup('- [ ] parent\n    - [x] child')).toBe(
      '    * [ ] parent\n        * [X] child\n\n'
    );
  });

  it('should render inline formatting after the checkbox', () => {
    expect(
      markup('* [ ] **bold** task', { strong: (t) => `[STRONG:${t}]` })
    ).toBe('    * [ ] [STRONG:bold] task\n\n');
  });

  it('should render loose task items once', () => {
    expect(markup('* [x] loose\n\n* [ ] two')).toBe(
      '    * [X] loose\n    * [ ] two\n\n'
    );
  });

  it('should render loose task items starting with inline formatting', () => {
    expect(
      markup('* [x] **bold** loose\n\n* [ ] _em_', {
        strong: (t) => `[STRONG:${t}]`,
        em: (t) => `[EM:${t}]`
      })
    ).toBe('    * [X] [STRONG:bold] loose\n    * [ ] [EM:em]\n\n');
  });

  it('should render loose task items followed by other blocks', () => {
    expect(markup('* [x] code\n\n  ```\n  c\n  ```')).toBe(
      '    * [X] code\n          c\n\n'
    );
  });

  it('should only treat the leading checkbox as a task', () => {
    expect(markup('* [ ] check [ ] twice')).toBe(
      '    * [ ] check [ ] twice\n\n'
    );
  });

  it('should reflow task items with the checkbox', () => {
    expect(
      markup('* [ ] A task item that is long enough to wrap', {
        reflowText: true,
        width: 30
      })
    ).toBe('    * [ ] A task item that is\n      long enough to wrap\n\n');
  });

  it('should leave checkboxes as text when gfm is disabled', () => {
    expect(markup('* [ ] task item\n* [x] done', {}, false)).toBe(
      '    * [ ] task item\n    * [x] done\n\n'
    );
  });

  it.each([
    ['without text', '* [ ]', '    * [ ]\n\n'],
    ['without a space after the box', '* [ ]text', '    * [ ]text\n\n'],
    ['with an unknown marker', '* [-] item', '    * [-] item\n\n'],
    ['with a link', '* [link](http://x.y)', '    * link (http://x.y)\n\n']
  ])('should not render items %s as tasks', (_, md, expected) => {
    expect(markup(md)).toBe(expected);
  });
});

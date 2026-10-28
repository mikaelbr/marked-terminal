import { describe, expect, it } from 'vitest';
import type { TerminalRendererOptions } from '../src/index.ts';
import { plainOptions, render, stripTermEsc } from './helpers.ts';

const tableOptions: TerminalRendererOptions = {
  ...plainOptions,
  tableOptions: { chars: { top: '@@@@TABLE@@@@@' } }
};

const reflowOptions: TerminalRendererOptions = {
  reflowText: true,
  showSectionPrefix: false,
  width: 10
};

describe('Renderer', () => {
  const markup = (str: string, gfm = false) =>
    stripTermEsc(render(str, reflowOptions, { gfm }));

  it('should render links', () => {
    expect(render('[Google](http://google.com)', plainOptions).trim()).toBe(
      'Google (http://google.com)'
    );
  });

  it('should pass on options to table', () => {
    const text =
      '| Lorem | Ipsum | Sit amet     | Dolar  |\n' +
      '|------|------|----------|----------|\n' +
      '| Row 1  | Value    | Value  | Value |\n' +
      '| Row 2  | Value    | Value  | Value |\n' +
      '| Row 3  | Value    | Value  | Value |\n' +
      '| Row 4  | Value    | Value  | Value |';

    expect(render(text, tableOptions)).toContain('@@@@TABLE@@@@@');
  });

  it('should not show link href twice if link and url is equal', () => {
    const text = 'http://google.com';
    expect(render(text, plainOptions).trim()).toBe(text);
  });

  it('should render html as html', () => {
    const html = '<strong>foo</strong>';
    expect(render(html, plainOptions).trim()).toBe(html);
  });

  it('should not escape entities', () => {
    const text =
      '# This < is "foo". it\'s a & string\n' +
      '> This < is "foo". it\'s a & string\n\n' +
      'This < is **"foo"**. it\'s a & string\n' +
      'This < is "foo". it\'s a & string';

    const expected =
      '# This < is "foo". it\'s a & string\n\n' +
      '    This < is "foo". it\'s a & string\n\n' +
      'This < is "foo". it\'s a & string\n' +
      'This < is "foo". it\'s a & string';
    expect(render(text, plainOptions).trim()).toBe(expected);
  });

  it('should not translate emojis inside codespans', () => {
    expect(render('Some `:+1:`', plainOptions)).toContain(':+1:');
  });

  it('should translate emojis', () => {
    expect(render('Some :+1:', plainOptions)).not.toContain(':+1');
  });

  it('should show default if not supported emojis', () => {
    expect(render('Some :someundefined:', plainOptions)).toContain(
      ':someundefined:'
    );
  });

  it('should not escape entities in tables', () => {
    const text =
      'Usage | Syntax\r\n' +
      '------|-------\r\n' +
      'General |`$ shell <CommandParam>`';

    expect(render(text, plainOptions)).toContain('<CommandParam>');
  });

  it('should reflow tables to fit within width', () => {
    const text =
      'Usage | Syntax\n------|-------\nGeneral |`$ shell <CommandParam>`';
    const result = stripTermEsc(
      render(text, { ...reflowOptions, width: 20 }, { gfm: true })
    );
    expect(result).toBe(
      '┌────────┬────────┐\n' +
        '│ Usage  │ Syntax │\n' +
        '├────────┼────────┤\n' +
        '│ Gener… │ $      │\n' +
        '│        │ shell  │\n' +
        '│        │ <Comm… │\n' +
        '└────────┴────────┘\n\n'
    );
    for (const line of result.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });

  it('should not stretch tables that already fit when reflowing', () => {
    const result = stripTermEsc(
      render(
        'a | b\n--|--\n1 | 2',
        { ...reflowOptions, width: 20 },
        { gfm: true }
      )
    );
    expect(result).toBe(
      '┌───┬───┐\n│ a │ b │\n├───┼───┤\n│ 1 │ 2 │\n└───┴───┘\n\n'
    );
  });

  it('should respect user colWidths when reflowing tables', () => {
    const text = 'Usage | Syntax\n------|-------\nGeneral | Value';
    const result = stripTermEsc(
      render(
        text,
        { ...reflowOptions, tableOptions: { colWidths: [12, 12] } },
        { gfm: true }
      )
    );
    expect(result.split('\n')[0]).toBe('┌────────────┬────────────┐');
  });

  it('should reflow paragraph and split words that are too long (one break)', () => {
    expect(markup('Now is the time: 01234567890\n')).toBe(
      'Now is the\ntime: 0123\n4567890\n\n'
    );
  });

  it('should reflow paragraph and split words that are too long (two breaks)', () => {
    expect(markup('Now is the time: http://timeanddate.com\n')).toBe(
      'Now is the\ntime: http\n://timeand\ndate.com\n\n'
    );
  });

  it('should reflow paragraph', () => {
    expect(markup('Now is the time\n')).toBe('Now is the\ntime\n\n');
  });

  it('should nuke section header', () => {
    expect(markup('# Contents\n')).toBe('Contents\n\n');
  });

  it('should reflow and nuke section header', () => {
    expect(markup('# Now is the time\n')).toBe('Now is the\ntime\n\n');
  });

  it('should preserve line breaks (gfm)', () => {
    expect(markup('Now  \nis    \nthe<br />time\n', true)).toBe(
      'Now\nis\nthe\ntime\n\n'
    );
  });

  it('should render ordered and unordered list with same newlines', () => {
    expect(markup('* ul item\n* ul item')).toBe(
      '    * ul item\n    * ul item\n\n'
    );
    expect(markup('1. ol item\n2. ol item')).toBe(
      '    1. ol item\n    2. ol item\n\n'
    );
  });

  it('should render nested lists', () => {
    expect(markup('* ul item\n    * ul item')).toBe(
      '    * ul item\n        * ul item\n\n'
    );
    expect(markup('1. ol item\n    1. ol item')).toBe(
      '    1. ol item\n        1. ol item\n\n'
    );
    expect(markup('1. ol item\n    * ul item')).toBe(
      '    1. ol item\n        * ul item\n\n'
    );
    expect(markup('* ul item\n    1. ol item')).toBe(
      '    * ul item\n        1. ol item\n\n'
    );
  });

  it('should render task items', () => {
    expect(markup('* [ ] task item\n* [X] task item')).toBe(
      '    * [ ] task item\n    * [X] task item\n\n'
    );
  });
});

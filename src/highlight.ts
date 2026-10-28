import { all, createEmphasize, type Sheet } from 'emphasize';
import { type StyleFn, shouldColorize, style } from './style.ts';

export type { Sheet } from 'emphasize';

/** Options for syntax highlighting of code blocks. */
export interface HighlightOptions {
  /**
   * Map of highlight.js classes (without the `hljs-` prefix) to style
   * functions. Descendant selectors (`'meta keyword'`) are supported.
   * Defaults to a theme matching marked-terminal v7 (cli-highlight).
   */
  sheet?: Sheet;
  /** Languages to consider when auto-detecting code without a language tag. */
  subset?: string[];
}

const emphasize = createEmphasize(all);

const plain: StyleFn = (text) => text;

// Port of cli-highlight's default theme, to keep output close to v7.
// Keys are matched in order and later keys win, so the highlight.js 11
// sub-scopes (`function_`, `class_`) must come after `title`.
export const defaultSheet: Sheet = {
  keyword: style('blue'),
  built_in: style('cyan'),
  type: style(['cyan', 'dim']),
  literal: style('blue'),
  number: style('green'),
  regexp: style('red'),
  string: style('red'),
  subst: plain,
  symbol: plain,
  class: style('blue'),
  title: plain,
  function_: style('yellow'),
  class_: style('blue'),
  params: plain,
  comment: style('green'),
  doctag: style('green'),
  meta: style('gray'),
  section: plain,
  tag: style('gray'),
  name: style('blue'),
  attr: style('cyan'),
  attribute: plain,
  variable: plain,
  bullet: plain,
  code: plain,
  emphasis: style('italic'),
  strong: style('bold'),
  formula: plain,
  link: style('underline'),
  quote: plain,
  addition: style('green'),
  deletion: style('red')
};

export function highlight(
  code: string,
  language: string | undefined,
  fallback: StyleFn,
  options: HighlightOptions
): string {
  if (!shouldColorize()) return code;

  const sheet = options.sheet ?? defaultSheet;
  if (!language) {
    return emphasize.highlightAuto(code, { sheet, subset: options.subset })
      .value;
  }
  if (!emphasize.registered(language)) return fallback(code);
  return emphasize.highlight(language, code, sheet).value;
}

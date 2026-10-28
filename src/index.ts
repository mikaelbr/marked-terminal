import ansiEscapes from 'ansi-escapes';
import ansiRegex from 'ansi-regex';
import chalk from 'chalk';
import Table from 'cli-table3';
import type {
  MarkedExtension,
  MarkedOptions,
  Parser,
  Token,
  Tokens
} from 'marked';
import * as emoji from 'node-emoji';
import supportsHyperlinks from 'supports-hyperlinks';
import { type HighlightOptions, highlight } from './highlight.ts';
import type { StyleFn } from './style.ts';

export type { HighlightOptions } from './highlight.ts';
export type { StyleFn } from './style.ts';

export type ListFn = (body: string, ordered: boolean, indent: string) => string;
export type ImageFn = (
  href: string,
  title: string | null | undefined,
  text: string
) => string;

/** Options for styling and layout of the rendered output. */
export interface TerminalRendererOptions {
  code?: StyleFn;
  blockquote?: StyleFn;
  html?: StyleFn;
  heading?: StyleFn;
  firstHeading?: StyleFn;
  hr?: StyleFn;
  listitem?: StyleFn;
  /** Formats the bullet points and numbers for lists. */
  list?: ListFn;
  table?: StyleFn;
  paragraph?: StyleFn;
  strong?: StyleFn;
  em?: StyleFn;
  codespan?: StyleFn;
  del?: StyleFn;
  link?: StyleFn;
  href?: StyleFn;
  text?: StyleFn;
  /** Undo marked's escaping of entities (`&quot;` -> `"` etc). */
  unescape?: boolean;
  /** Replace `:emoji:` codes with emojis. */
  emoji?: boolean;
  /** Output width, only applicable when `reflowText` is true. */
  width?: number;
  /** Prefix headings with `#`s. */
  showSectionPrefix?: boolean;
  reflowText?: boolean;
  /** Indentation as number of spaces, or a string of tab characters. */
  tab?: number | string;
  /** Options passed to cli-table3. */
  tableOptions?: Table.TableConstructorOptions;
  /** Override the default image rendering. */
  image?: ImageFn;
}

type ResolvedOptions = Required<Omit<TerminalRendererOptions, 'image'>> &
  Pick<TerminalRendererOptions, 'image'>;

const TABLE_CELL_SPLIT = '^*||*^';
const TABLE_ROW_WRAP = '*|*|*|*';
const TABLE_ROW_WRAP_REGEXP = new RegExp(escapeRegExp(TABLE_ROW_WRAP), 'g');

const COLON_REPLACER = '*#COLON|*';
const COLON_REPLACER_REGEXP = new RegExp(escapeRegExp(COLON_REPLACER), 'g');

const TAB_ALLOWED_CHARACTERS = ['\t'];

const ANSI_REGEXP = ansiRegex();

// C0 control characters (except tab and newline), DEL and C1 control
// characters. These must never be passed through from the Markdown input,
// as they allow injecting arbitrary ANSI/OSC escape sequences into the
// terminal (e.g. ESC, BEL and the 8-bit CSI introducer 0x9B).
const CONTROL_CHARS_REGEXP = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

// HARD_RETURN holds a character sequence used to indicate text has a
// hard (no-reflowing) line break.  Previously \r and \r\n were turned
// into \n in marked's lexer- preprocessing step. So \r is safe to use
// to indicate a hard (non-reflowed) return.
const HARD_RETURN = '\r';
const HARD_RETURN_RE = new RegExp(HARD_RETURN);
const HARD_RETURN_GFM_RE = new RegExp(`${HARD_RETURN}|<br />`);

const defaultOptions: ResolvedOptions = {
  code: chalk.yellow,
  blockquote: chalk.gray.italic,
  html: chalk.gray,
  heading: chalk.green.bold,
  firstHeading: chalk.magenta.underline.bold,
  hr: chalk.reset,
  listitem: chalk.reset,
  list: list,
  table: chalk.reset,
  paragraph: chalk.reset,
  strong: chalk.bold,
  em: chalk.italic,
  codespan: chalk.yellow,
  del: chalk.dim.gray.strikethrough,
  link: chalk.blue,
  href: chalk.blue.underline,
  text: identity,
  unescape: true,
  emoji: true,
  width: 80,
  showSectionPrefix: true,
  reflowText: false,
  tab: 4,
  tableOptions: {}
};

// Compute length of str not including ANSI escape codes.
// See http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
function textLength(str: string): number {
  return str.replace(ANSI_REGEXP, '').length;
}

function fixHardReturn(text: string, reflow: boolean): string {
  return reflow ? text.replace(HARD_RETURN, '\n') : text;
}

/**
 * Renderer for marked that outputs to the terminal.
 *
 * Prefer `marked.use(markedTerminal(options))`. The class can also be
 * passed directly as `marked.setOptions({ renderer: new TerminalRenderer() })`.
 */
export default class TerminalRenderer {
  o: ResolvedOptions;
  tab: string;
  tableSettings: Table.TableConstructorOptions;
  emoji: StyleFn;
  unescape: StyleFn;
  highlightOptions: HighlightOptions;
  transform: StyleFn;

  /** Set by marked before rendering. */
  options!: MarkedOptions;
  /** Set by marked before rendering. */
  parser!: Parser;

  constructor(
    options?: TerminalRendererOptions,
    highlightOptions?: HighlightOptions
  ) {
    this.o = { ...defaultOptions, ...options };
    this.tab = sanitizeTab(this.o.tab, defaultOptions.tab as number);
    this.tableSettings = this.o.tableOptions;
    this.emoji = this.o.emoji ? insertEmojis : identity;
    this.unescape = this.o.unescape ? unescapeEntities : identity;
    this.highlightOptions = highlightOptions ?? {};

    this.transform = compose(undoColon, this.unescape, this.emoji);
  }

  textLength(str: string): number {
    return textLength(str);
  }

  space(): string {
    return '';
  }

  text(token: Tokens.Text | Tokens.Escape): string {
    return this.o.text(stripControlChars(token.text));
  }

  code(token: Tokens.Code): string {
    return section(
      indentify(
        this.tab,
        highlight(
          fixHardReturn(stripControlChars(token.text), this.o.reflowText),
          token.lang,
          this.o.code,
          this.highlightOptions
        )
      )
    );
  }

  blockquote(token: Tokens.Blockquote): string {
    const quote = this.parser.parse(token.tokens);
    return section(this.o.blockquote(indentify(this.tab, quote.trim())));
  }

  html(token: Tokens.HTML | Tokens.Tag): string {
    return this.o.html(stripControlChars(token.text));
  }

  heading(token: Tokens.Heading): string {
    const level = token.depth;
    let text = this.transform(this.parser.parseInline(token.tokens));

    const prefix = this.o.showSectionPrefix ? `${'#'.repeat(level)} ` : '';
    text = prefix + text;
    if (this.o.reflowText) {
      text = reflowText(text, this.o.width, this.options.gfm);
    }
    return section(
      level === 1 ? this.o.firstHeading(text) : this.o.heading(text)
    );
  }

  hr(_token?: Tokens.Hr): string {
    return section(this.o.hr(hr('-', this.o.reflowText && this.o.width)));
  }

  list(token: Tokens.List): string {
    let body = '';
    for (const item of token.items) {
      body += this.listitem(item);
    }
    body = this.o.list(body, token.ordered, this.tab);
    return section(fixNestedLists(indentLines(this.tab, body), this.tab));
  }

  listitem(item: Tokens.ListItem): string {
    let text = '';
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        const first = item.tokens[0];
        if (first?.type === 'paragraph') {
          first.text = `${checkbox} ${first.text}`;
          const firstInline = first.tokens?.[0];
          if (firstInline?.type === 'text') {
            firstInline.text = `${checkbox} ${firstInline.text}`;
          }
        } else {
          item.tokens.unshift({
            type: 'text',
            raw: `${checkbox} `,
            text: `${checkbox} `
          });
        }
      } else {
        text += `${checkbox} `;
      }
    }

    // marked < 15 takes a second `top` argument, later versions ignore it
    const parse = this.parser.parse as (
      tokens: Token[],
      top?: boolean
    ) => string;
    text += parse.call(this.parser, item.tokens, !!item.loose);

    const transform = compose(this.o.listitem, this.transform);
    const isNested = text.includes('\n');
    if (isNested) text = text.trim();

    // Use BULLET_POINT as a marker for ordered or unordered list item
    return `\n${BULLET_POINT}${transform(text)}`;
  }

  checkbox(token: Pick<Tokens.Checkbox, 'checked'>): string {
    return `[${token.checked ? 'X' : ' '}] `;
  }

  paragraph(token: Tokens.Paragraph): string {
    const transform = compose(this.o.paragraph, this.transform);
    let text = transform(this.parser.parseInline(token.tokens));
    if (this.o.reflowText) {
      text = reflowText(text, this.o.width, this.options.gfm);
    }
    return section(text);
  }

  table(token: Tokens.Table): string {
    let cell = '';
    for (const headerCell of token.header) {
      cell += this.tablecell(headerCell);
    }
    const header = this.tablerow({ text: cell });

    let body = '';
    for (const row of token.rows) {
      cell = '';
      for (const rowCell of row) {
        cell += this.tablecell(rowCell);
      }
      body += this.tablerow({ text: cell });
    }

    const table = new Table({
      head: generateTableRow(header)[0],
      ...this.tableSettings
    });

    for (const row of generateTableRow(body, this.transform)) {
      table.push(row);
    }
    return section(this.o.table(table.toString()));
  }

  tablerow(token: Pick<Tokens.TableRow, 'text'>): string {
    return `${TABLE_ROW_WRAP}${token.text}${TABLE_ROW_WRAP}\n`;
  }

  tablecell(token: Tokens.TableCell): string {
    return this.parser.parseInline(token.tokens) + TABLE_CELL_SPLIT;
  }

  // span level renderer
  strong(token: Tokens.Strong): string {
    return this.o.strong(this.parser.parseInline(token.tokens));
  }

  em(token: Tokens.Em): string {
    const text = this.parser.parseInline(token.tokens);
    return this.o.em(fixHardReturn(text, this.o.reflowText));
  }

  codespan(token: Tokens.Codespan): string {
    const text = fixHardReturn(
      stripControlChars(token.text),
      this.o.reflowText
    );
    return this.o.codespan(text.replace(/:/g, COLON_REPLACER));
  }

  br(_token?: Tokens.Br): string {
    return this.o.reflowText ? HARD_RETURN : '\n';
  }

  del(token: Tokens.Del): string {
    return this.o.del(this.parser.parseInline(token.tokens));
  }

  link(token: Tokens.Link): string {
    const text = this.parser.parseInline(token.tokens);
    // `text` is already rendered (and sanitized) inline content
    const href = stripControlChars(token.href);
    const hasText = text && text !== href;

    let out = '';

    if (supportsHyperlinks.stdout) {
      const link = text ? this.o.href(this.emoji(text)) : this.o.href(href);
      out = ansiEscapes.link(
        link,
        // textLength breaks on '+' in URLs
        href.replace(/\+/g, '%20')
      );
    } else {
      if (hasText) out += `${this.emoji(text)} (`;
      out += this.o.href(href);
      if (hasText) out += ')';
    }
    return this.o.link(out);
  }

  image(token: Tokens.Image): string {
    const href = stripControlChars(token.href);
    const title = stripControlChars(token.title);
    const text = stripControlChars(token.text);

    if (typeof this.o.image === 'function') {
      return this.o.image(href, title, text);
    }
    let out = `![${text}`;
    if (title) out += ` – ${title}`;
    return `${out}](${href})\n`;
  }
}

export { TerminalRenderer };

const RENDERER_FUNCTIONS = [
  'text',
  'code',
  'blockquote',
  'html',
  'heading',
  'hr',
  'list',
  'listitem',
  'checkbox',
  'paragraph',
  'table',
  'tablerow',
  'tablecell',
  'strong',
  'em',
  'codespan',
  'br',
  'del',
  'link',
  'image'
] as const;

type RendererFunction = (typeof RENDERER_FUNCTIONS)[number];

/**
 * Create a marked extension that renders Markdown for the terminal.
 *
 * @example
 * marked.use(markedTerminal({ width: 60, reflowText: true }));
 */
export function markedTerminal(
  options?: TerminalRendererOptions,
  highlightOptions?: HighlightOptions
): MarkedExtension {
  const r = new TerminalRenderer(options, highlightOptions);

  const renderer: Partial<
    Record<
      RendererFunction,
      (
        this: Pick<TerminalRenderer, 'options' | 'parser'>,
        token: never
      ) => string
    >
  > = {};
  for (const func of RENDERER_FUNCTIONS) {
    renderer[func] = function (token) {
      r.options = this.options;
      r.parser = this.parser;
      return (r[func] as (token: unknown) => string)(token);
    };
  }

  // `useNewRenderer` makes marked 13 pass tokens to extension renderers.
  // Later versions always do and ignore the flag.
  return { renderer, useNewRenderer: true } as MarkedExtension;
}

// Munge \n's and spaces in "text" so that the number of
// characters between \n's is less than or equal to "width".
function reflowText(
  text: string,
  width: number,
  gfm: boolean | undefined
): string {
  // Hard break was inserted by TerminalRenderer#br or is
  // <br /> when gfm is true
  const splitRe = gfm ? HARD_RETURN_GFM_RE : HARD_RETURN_RE;
  const sections = text.split(splitRe);
  const reflowed: string[] = [];

  for (const section of sections) {
    // Split the section by escape codes so that we can
    // deal with them separately.
    const fragments = section.split(/(\u001b\[(?:\d{1,3})(?:;\d{1,3})*m)/g);
    let column = 0;
    let currentLine = '';
    let lastWasEscapeChar = false;

    for (const fragment of fragments) {
      if (fragment === '') {
        lastWasEscapeChar = false;
        continue;
      }

      // This is an escape code - leave it whole and
      // move to the next fragment.
      if (!textLength(fragment)) {
        currentLine += fragment;
        lastWasEscapeChar = true;
        continue;
      }

      const words = fragment.split(/[ \t\n]+/);

      for (let word of words) {
        let addSpace = column !== 0 ? 1 : 0;
        if (lastWasEscapeChar) addSpace = 0;

        // If adding the new word overflows the required width
        if (column + word.length + addSpace > width) {
          if (word.length <= width) {
            // If the new word is smaller than the required width
            // just add it at the beginning of a new line
            reflowed.push(currentLine);
            currentLine = word;
            column = word.length;
          } else {
            // If the new word is longer than the required width
            // split this word into smaller parts.
            const w = word.slice(0, width - column - addSpace);
            if (addSpace) currentLine += ' ';
            currentLine += w;
            reflowed.push(currentLine);
            currentLine = '';
            column = 0;

            word = word.slice(w.length);
            while (word.length) {
              const part = word.slice(0, width);

              if (!part.length) break;

              if (part.length < width) {
                currentLine = part;
                column = part.length;
                break;
              }
              reflowed.push(part);
              word = word.slice(width);
            }
          }
        } else {
          if (addSpace) {
            currentLine += ' ';
            column++;
          }

          currentLine += word;
          column += word.length;
        }

        lastWasEscapeChar = false;
      }
    }

    if (textLength(currentLine)) reflowed.push(currentLine);
  }

  return reflowed.join('\n');
}

function indentLines(indent: string, text: string): string {
  return text.replace(/(^|\n)(.+)/g, `$1${indent}$2`);
}

function indentify(indent: string, text: string): string {
  if (!text) return text;
  return indent + text.split('\n').join(`\n${indent}`);
}

const BULLET_POINT_REGEX = '\\*';
const NUMBERED_POINT_REGEX = '\\d+\\.';
const POINT_REGEX = `(?:${[BULLET_POINT_REGEX, NUMBERED_POINT_REGEX].join('|')})`;

// Prevents nested lists from joining their parent list's last line
function fixNestedLists(body: string, indent: string): string {
  const regex = new RegExp(
    '' +
      '(\\S(?: |  )?)' + // Last char of current point, plus one or two spaces
      // to allow trailing spaces
      '((?:' +
      indent +
      ')+)' + // Indentation of sub point
      '(' +
      POINT_REGEX +
      '(?:.*)+)$', // Body of subpoint
    'gm'
  );
  return body.replace(regex, `$1\n${indent}$2$3`);
}

function isPointedLine(line: string, indent: string): boolean {
  return new RegExp(`^(?:${indent})*${POINT_REGEX}`).test(line);
}

function toSpaces(str: string): string {
  return ' '.repeat(str.length);
}

const BULLET_POINT = '* ';
function bulletPointLine(indent: string, line: string): string {
  return isPointedLine(line, indent) ? line : toSpaces(BULLET_POINT) + line;
}

function bulletPointLines(lines: string, indent: string): string {
  return lines
    .split('\n')
    .filter(identity)
    .map((line) => bulletPointLine(indent, line))
    .join('\n');
}

function numberedPoint(n: number): string {
  return `${n}. `;
}

function numberedLines(lines: string, indent: string): string {
  let num = 0;
  return lines
    .split('\n')
    .filter(identity)
    .map((line) => {
      if (isPointedLine(line, indent)) {
        num++;
        return line.replace(BULLET_POINT, numberedPoint(num));
      }
      return toSpaces(numberedPoint(num)) + line;
    })
    .join('\n');
}

function list(body: string, ordered: boolean, indent: string): string {
  body = body.trim();
  return ordered ? numberedLines(body, indent) : bulletPointLines(body, indent);
}

function section(text: string): string {
  return `${text}\n\n`;
}

function insertEmojis(text: string): string {
  return text.replace(/:([A-Za-z0-9_\-+]+?):/g, (emojiString) => {
    const emojiSign = emoji.get(emojiString);
    if (!emojiSign) return emojiString;
    return `${emojiSign} `;
  });
}

function hr(inputHrStr: string, length: number | false): string {
  const width = length || process.stdout.columns || 0;
  return inputHrStr.repeat(Math.max(width - 1, 0));
}

function undoColon(str: string): string {
  return str.replace(COLON_REPLACER_REGEXP, ':');
}

function generateTableRow(
  text: string,
  transform: StyleFn = identity
): string[][] {
  if (!text) return [];
  const lines = transform(text).split('\n');

  const data: string[][] = [];
  for (const line of lines) {
    if (!line) continue;
    const parsed = line
      .replace(TABLE_ROW_WRAP_REGEXP, '')
      .split(TABLE_CELL_SPLIT);

    data.push(parsed.slice(0, parsed.length - 1));
  }
  return data;
}

function escapeRegExp(str: string): string {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
}

function unescapeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripControlChars<T extends string | null | undefined>(str: T): T {
  if (typeof str !== 'string') return str;
  return str.replace(CONTROL_CHARS_REGEXP, '') as T;
}

function identity<T>(str: T): T {
  return str;
}

function compose(...funcs: StyleFn[]): StyleFn {
  return (text) => funcs.reduceRight((acc, fn) => fn(acc), text);
}

function isAllowedTabString(str: string): boolean {
  return TAB_ALLOWED_CHARACTERS.some((char) =>
    new RegExp(`^(${char})+$`).test(str)
  );
}

function sanitizeTab(tab: number | string, fallbackTab: number): string {
  if (typeof tab === 'number') {
    return ' '.repeat(tab);
  }
  if (typeof tab === 'string' && isAllowedTabString(tab)) {
    return tab;
  }
  return ' '.repeat(fallbackTab);
}

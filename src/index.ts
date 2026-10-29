import { stripVTControlCharacters } from 'node:util';
import Table from 'cli-table3';
import type { MarkedExtension, RendererObject, Token } from 'marked';
import * as emoji from 'node-emoji';
import supportsHyperlinks from 'supports-hyperlinks';
import { type HighlightOptions, highlight } from './highlight.ts';
import { type StyleFn, style } from './style.ts';

export type { HighlightOptions, Sheet } from './highlight.ts';
export { defaultSheet } from './highlight.ts';
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
  /**
   * Render links as clickable terminal hyperlinks (OSC 8) instead of
   * `text (url)`. Detected from stdout when not set.
   */
  hyperlinks?: boolean;
}

type ResolvedOptions = Required<
  Omit<TerminalRendererOptions, 'image' | 'hyperlinks'>
> &
  Pick<TerminalRendererOptions, 'image' | 'hyperlinks'>;

const TABLE_CELL_SPLIT = '^*||*^';
const TABLE_ROW_WRAP = '*|*|*|*';
const TABLE_ROW_WRAP_REGEXP = new RegExp(escapeRegExp(TABLE_ROW_WRAP), 'g');

const COLON_REPLACER = '*#COLON|*';
const COLON_REPLACER_REGEXP = new RegExp(escapeRegExp(COLON_REPLACER), 'g');

const TAB_ALLOWED_CHARACTERS = ['\t'];

// C0 control characters (except tab and newline), DEL and C1 control
// characters. These must never be passed through from the Markdown input,
// as they allow injecting arbitrary ANSI/OSC escape sequences into the
// terminal (e.g. ESC, BEL and the 8-bit CSI introducer 0x9B).
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters
const CONTROL_CHARS_REGEXP = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

// HARD_RETURN holds a character sequence used to indicate text has a
// hard (no-reflowing) line break.  Previously \r and \r\n were turned
// into \n in marked's lexer- preprocessing step. So \r is safe to use
// to indicate a hard (non-reflowed) return.
const HARD_RETURN = '\r';
const HARD_RETURN_RE = new RegExp(HARD_RETURN);
const HARD_RETURN_GFM_RE = new RegExp(`${HARD_RETURN}|<br />`);

const defaultOptions: ResolvedOptions = {
  code: style('yellow'),
  blockquote: style(['gray', 'italic']),
  html: style('gray'),
  heading: style(['green', 'bold']),
  firstHeading: style(['magenta', 'underline', 'bold']),
  hr: style('reset'),
  listitem: style('reset'),
  list: list,
  table: style('reset'),
  paragraph: style('reset'),
  strong: style('bold'),
  em: style('italic'),
  codespan: style('yellow'),
  del: style(['dim', 'gray', 'strikethrough']),
  link: style('blue'),
  href: style(['blue', 'underline']),
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
  return stripVTControlCharacters(str).length;
}

function fixHardReturn(text: string, reflow: boolean): string {
  return reflow ? text.replace(HARD_RETURN, '\n') : text;
}

/**
 * Create a marked extension that renders Markdown for the terminal.
 *
 * @example
 * marked.use(markedTerminal({ width: 60, reflowText: true }));
 */
export function markedTerminal(
  options?: TerminalRendererOptions,
  highlightOptions: HighlightOptions = {}
): MarkedExtension {
  const o: ResolvedOptions = { ...defaultOptions, ...options };
  const tab = sanitizeTab(o.tab, defaultOptions.tab as number);
  const insertEmoji = o.emoji ? insertEmojis : identity;
  const unescapeHtml = o.unescape ? unescapeEntities : identity;
  const transform = compose(undoColon, unescapeHtml, insertEmoji);
  const hyperlinks = o.hyperlinks ?? supportsHyperlinks.stdout;

  // Columns taken up by list indentation and markers around the content
  // currently being rendered, so reflowed list content fits within width.
  let listIndent = 0;
  let listMarkerWidth = 0;
  const reflow = (text: string, gfm: boolean | undefined) =>
    reflowText(text, Math.max(o.width - listIndent - listMarkerWidth, 1), gfm);

  const renderer: RendererObject = {
    space() {
      return '';
    },

    text(token) {
      // Block-level text tokens (e.g. in tight list items) carry inline tokens
      const text =
        'tokens' in token && token.tokens
          ? this.parser.parseInline(token.tokens)
          : stripControlChars(token.text);
      return o.text(text);
    },

    code(token) {
      return section(
        indentify(
          tab,
          highlight(
            fixHardReturn(stripControlChars(token.text), o.reflowText),
            token.lang,
            o.code,
            highlightOptions
          )
        )
      );
    },

    blockquote(token) {
      const quote = this.parser.parse(token.tokens);
      return section(o.blockquote(indentify(tab, quote.trim())));
    },

    html(token) {
      return o.html(stripControlChars(token.text));
    },

    heading(token) {
      const level = token.depth;
      let text = transform(this.parser.parseInline(token.tokens));

      const prefix = o.showSectionPrefix ? `${'#'.repeat(level)} ` : '';
      text = prefix + text;
      if (o.reflowText) {
        text = reflow(text, this.options.gfm);
      }
      return section(level === 1 ? o.firstHeading(text) : o.heading(text));
    },

    hr() {
      return section(o.hr(hr('-', o.reflowText && o.width)));
    },

    list(token) {
      const parentIndent = listIndent;
      const parentMarkerWidth = listMarkerWidth;
      listIndent += tab.length;
      listMarkerWidth = token.ordered
        ? numberedPoint(token.items.length).length
        : BULLET_POINT.length;

      let body = '';
      for (const item of token.items) {
        body += this.listitem(item);
      }

      listIndent = parentIndent;
      listMarkerWidth = parentMarkerWidth;
      body = o.list(body, token.ordered, tab);
      return section(fixNestedLists(indentLines(tab, body), tab));
    },

    listitem(item) {
      let text = '';
      // marked >= 17 adds the checkbox token to the item itself
      if (item.task && !hasCheckboxToken(item.tokens)) {
        // The checkbox renderer output includes its trailing space
        const checkbox = this.checkbox({
          type: 'checkbox',
          raw: '',
          checked: !!item.checked
        });
        if (item.loose) {
          const first = item.tokens[0];
          // marked < 17 lexes loose item content as text, rendered as paragraphs
          if (first?.type === 'paragraph' || first?.type === 'text') {
            first.text = `${checkbox}${first.text}`;
            const firstInline = first.tokens?.[0];
            if (firstInline?.type === 'text') {
              firstInline.text = `${checkbox}${firstInline.text}`;
            } else {
              first.tokens?.unshift({
                type: 'text',
                raw: checkbox,
                text: checkbox
              });
            }
          } else {
            item.tokens.unshift({
              type: 'text',
              raw: checkbox,
              text: checkbox
            });
          }
        } else {
          text += checkbox;
        }
      }

      // marked < 15 takes a second `top` argument, later versions ignore it
      const parse = this.parser.parse as (
        tokens: Token[],
        top?: boolean
      ) => string;
      // Style only the item's own content. Nested lists are already styled,
      // and styling across newlines makes chalk insert escape codes at line
      // starts, which breaks nested list indentation.
      const ownTokens = item.tokens.filter((t) => t.type !== 'list');
      const nestedLists = item.tokens.filter((t) => t.type === 'list');
      text += parse.call(this.parser, ownTokens, !!item.loose);
      if (text.includes('\n')) text = text.trim();
      text = transform(text);
      // Loose items are reflowed as paragraphs; tight items are bare text
      if (
        o.reflowText &&
        ownTokens.every((t) => t.type === 'text' || t.type === 'checkbox')
      ) {
        text = reflow(text, this.options.gfm);
      }

      const nested = parse.call(this.parser, nestedLists).trimEnd();

      // Use BULLET_POINT as a marker for ordered or unordered list item
      return `\n${BULLET_POINT}${o.listitem(text)}${nested && `\n${nested}`}`;
    },

    checkbox(token) {
      return `[${token.checked ? 'X' : ' '}] `;
    },

    paragraph(token) {
      let text = o.paragraph(transform(this.parser.parseInline(token.tokens)));
      if (o.reflowText) {
        text = reflow(text, this.options.gfm);
      }
      return section(text);
    },

    table(token) {
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

      const head = generateTableRow(header)[0];
      const rows = generateTableRow(body, transform);
      const buildTable = (extra: Table.TableConstructorOptions = {}) => {
        const table = new Table({ head, ...o.tableOptions, ...extra });
        for (const row of rows) {
          table.push(row);
        }
        return table.toString();
      };

      let rendered = buildTable();
      if (
        o.reflowText &&
        o.width &&
        head?.length &&
        !o.tableOptions?.colWidths?.length &&
        textLength(rendered.split('\n')[0] ?? '') > o.width
      ) {
        // Distribute available width equally, minus the column borders
        const columnWidth = Math.max(
          Math.floor((o.width - (head.length + 1)) / head.length),
          3
        );
        rendered = buildTable({
          colWidths: head.map(() => columnWidth),
          wordWrap: o.tableOptions?.wordWrap ?? true
        });
      }
      return section(o.table(rendered));
    },

    tablerow(token) {
      return `${TABLE_ROW_WRAP}${token.text}${TABLE_ROW_WRAP}\n`;
    },

    tablecell(token) {
      return this.parser.parseInline(token.tokens) + TABLE_CELL_SPLIT;
    },

    // span level renderer
    strong(token) {
      return o.strong(this.parser.parseInline(token.tokens));
    },

    em(token) {
      const text = this.parser.parseInline(token.tokens);
      return o.em(fixHardReturn(text, o.reflowText));
    },

    codespan(token) {
      const text = fixHardReturn(stripControlChars(token.text), o.reflowText);
      return o.codespan(text.replace(/:/g, COLON_REPLACER));
    },

    br() {
      return o.reflowText ? HARD_RETURN : '\n';
    },

    del(token) {
      return o.del(this.parser.parseInline(token.tokens));
    },

    link(token) {
      const text = this.parser.parseInline(token.tokens);
      // `text` is already rendered (and sanitized) inline content
      const href = stripControlChars(token.href);
      const hasText = text && text !== href;

      let out = '';

      if (hyperlinks) {
        const link = text ? o.href(insertEmoji(text)) : o.href(href);
        out = terminalLink(
          link,
          // textLength breaks on '+' in URLs
          href.replace(/\+/g, '%20')
        );
      } else {
        if (hasText) out += `${insertEmoji(text)} (`;
        out += o.href(href);
        if (hasText) out += ')';
      }
      return o.link(out);
    },

    image(token) {
      const href = stripControlChars(token.href);
      const title = stripControlChars(token.title);
      const text = stripControlChars(token.text);

      if (typeof o.image === 'function') {
        return o.image(href, title, text);
      }
      let out = `![${text}`;
      if (title) out += ` – ${title}`;
      return `${out}](${href})\n`;
    }
  };

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
    // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes
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
// Tight items get a block checkbox token, loose items an inline one
// at the start of their first paragraph
function hasCheckboxToken(tokens: Token[]): boolean {
  const first = tokens[0];
  if (first?.type === 'checkbox') return true;
  return first?.type === 'paragraph' && first.tokens?.[0]?.type === 'checkbox';
}

// Only this list's own points start with a marker, nested ones are indented
function isOwnPoint(line: string): boolean {
  return line.startsWith(BULLET_POINT);
}

// Replaces the list's own markers with `point(num)` and indents the item's
// continuation lines to align with its text. Nested lists come last in an
// item and are already formatted, so they are left as is.
function pointLines(
  lines: string[],
  indent: string,
  point: (num: number) => string
): string {
  let num = 0;
  let inNested = false;
  return lines
    .map((line) => {
      if (isOwnPoint(line)) {
        num++;
        inNested = false;
        return point(num) + line.slice(BULLET_POINT.length);
      }
      if (inNested || isPointedLine(line, indent)) {
        inNested = true;
        return line;
      }
      return toSpaces(point(num)) + line;
    })
    .join('\n');
}

function bulletPointLines(lines: string, indent: string): string {
  return pointLines(
    lines.split('\n').filter(identity),
    indent,
    () => BULLET_POINT
  );
}

// Pads the point to the width of the largest number so item text aligns
function numberedPoint(n: number, max = n): string {
  return `${`${n}.`.padEnd(`${max}.`.length)} `;
}

function numberedLines(lines: string, indent: string): string {
  const nonEmpty = lines.split('\n').filter(identity);
  const max = nonEmpty.filter(isOwnPoint).length;
  return pointLines(nonEmpty, indent, (num) => numberedPoint(num, max));
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

// OSC 8 hyperlink, see https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda
function terminalLink(text: string, url: string): string {
  return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
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

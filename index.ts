import chalk from 'chalk';
import Table from 'cli-table3';
import { highlight as highlightCli } from 'cli-highlight';
import type { HighlightOptions } from 'cli-highlight';
import * as emoji from 'node-emoji';
import ansiEscapes from 'ansi-escapes';
import supportsHyperlinks from 'supports-hyperlinks';
import ansiRegex from 'ansi-regex';
import type {
  MarkedExtension,
  MarkedOptions,
  RendererObject,
  Tokens,
  Parser
} from 'marked';

// === Type Definitions ===

type StyleFn = (...text: string[]) => string;

type TableCtorOptions = Table.TableConstructorOptions;

export interface TerminalRendererOptions {
  code: StyleFn;
  blockquote: StyleFn;
  html: StyleFn;
  heading: StyleFn;
  firstHeading: StyleFn;
  hr: StyleFn;
  listitem: StyleFn;
  list: (body: string, ordered: boolean, indent: string) => string;
  table: StyleFn;
  paragraph: StyleFn;
  strong: StyleFn;
  em: StyleFn;
  codespan: StyleFn;
  del: StyleFn;
  link: StyleFn;
  href: StyleFn;
  text: StyleFn;
  image?: (href: string, title: string | null, text: string) => string;
  unescape: boolean;
  emoji: boolean;
  width: number;
  showSectionPrefix: boolean;
  reflowText: boolean;
  tab: number | string;
  tableOptions: TableCtorOptions;
  sanitize: boolean;
}

// === Constants ===

const COLON_REPLACER = '*#COLON|*';
const COLON_REPLACER_REGEXP = new RegExp(escapeRegExp(COLON_REPLACER), 'g');

const TAB_ALLOWED_CHARACTERS = ['\t'];

const ANSI_REGEXP = ansiRegex();

const HARD_RETURN = '\r';
const HARD_RETURN_RE = new RegExp(HARD_RETURN);
const HARD_RETURN_GFM_RE = new RegExp(HARD_RETURN + '|<br />');

const BULLET_POINT = '* ';
const BULLET_POINT_REGEX = '\\*';
const NUMBERED_POINT_REGEX = '\\d+\\.';
const POINT_REGEX =
  '(?:' + [BULLET_POINT_REGEX, NUMBERED_POINT_REGEX].join('|') + ')';

function asTabNumber(tab: number | string) {
  if (typeof tab === 'number') {
    if (tab === 2 || tab === 4 || tab === 8) {
      return tab;
    }
    return 4;
  }

  const tabN = Number.parseInt(tab);
  if (Number.isNaN(tabN)) {
    return 4;
  }
  return asTabNumber(tabN);
}

// === Default Options ===

const defaultOptions: TerminalRendererOptions = {
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
  tableOptions: {},
  sanitize: false
};

// === TerminalRenderer Class ===

class Renderer {
  private readonly config: TerminalRendererOptions;
  private readonly tabStr: string;
  private readonly tableSettings: TableCtorOptions;
  private readonly emojiFn: StyleFn;
  private readonly unescapeFn: StyleFn;
  private readonly highlightOptions: HighlightOptions;
  private readonly transform: StyleFn;

  private parser: Parser | undefined;
  markedOptions: MarkedOptions<string, string> | undefined;

  constructor(
    options?: Partial<TerminalRendererOptions>,
    highlightOptions?: HighlightOptions
  ) {
    this.config = { ...defaultOptions, ...options };
    this.tabStr = sanitizeTab(this.config.tab, asTabNumber(defaultOptions.tab));
    this.tableSettings = this.config.tableOptions;
    this.emojiFn = this.config.emoji ? insertEmojis : identity;
    this.unescapeFn = this.config.unescape ? unescapeEntities : identity;
    this.highlightOptions = highlightOptions ?? {};
    this.transform = compose(undoColon, this.unescapeFn, this.emojiFn);
  }

  setContext(parser: Parser, options: MarkedOptions<string, string>): void {
    this.parser = parser;
    this.markedOptions = options;
  }

  private getParser(): Parser {
    if (this.parser === undefined) {
      throw new Error(
        'TerminalRenderer: parser not set. Call setContext() before rendering.'
      );
    }
    return this.parser;
  }

  private getMarkedOptions(this: {
    options?: MarkedOptions<string, string> | undefined;
    markedOptions?: MarkedOptions<string, string> | undefined;
  }): MarkedOptions<string, string> {
    if (this.markedOptions !== undefined) return this.markedOptions;
    // When the renderer is passed directly to marked() (not via the
    // markedTerminal() extension), marked sets `renderer.options` and
    // `renderer.parser` dynamically instead of calling setContext().
    const fallback = this.options;
    if (fallback !== undefined) return fallback;
    throw new Error(
      'TerminalRenderer: options not set. Call setContext() before rendering.'
    );
  }

  textLength(str: string): number {
    return textLength(str);
  }

  space(_token: Tokens.Space): '' {
    return '';
  }

  text(token: Tokens.Text | Tokens.Escape): string {
    return this.config.text(token.text);
  }

  code(token: Tokens.Code): string {
    return section(
      identify(
        this.tabStr,
        highlight(token.text, token.lang, this.config, this.highlightOptions)
      )
    );
  }

  blockquote(token: Tokens.Blockquote): string {
    const quote = this.getParser().parse(token.tokens);
    return section(this.config.blockquote(identify(this.tabStr, quote.trim())));
  }

  html(token: Tokens.HTML | Tokens.Tag): string {
    return this.config.html(token.text);
  }

  heading(token: Tokens.Heading): string {
    let text = this.getParser().parseInline(token.tokens);
    text = this.transform(text);

    const prefix = this.config.showSectionPrefix
      ? '#'.repeat(token.depth) + ' '
      : '';
    text = prefix + text;

    if (this.config.reflowText) {
      text = reflowText(
        text,
        this.config.width,
        this.getMarkedOptions().gfm ?? false
      );
    }

    return section(
      token.depth === 1
        ? this.config.firstHeading(text)
        : this.config.heading(text)
    );
  }

  hr(_token: Tokens.Hr): string {
    return section(
      this.config.hr(hr('-', this.config.reflowText && this.config.width))
    );
  }

  list(token: Tokens.List): string {
    let body = '';
    for (const item of token.items) {
      body += this.listitem(item);
    }
    body = this.config.list(body, token.ordered, this.tabStr);
    return section(fixNestedLists(indentLines(this.tabStr, body), this.tabStr));
  }

  listitem(item: Tokens.ListItem): string {
    let text = '';

    if (item.task) {
      const checkbox = this.checkbox({
        type: 'checkbox',
        raw: item.raw,
        checked: item.checked ?? false
      });

      if (item.loose) {
        let modified = false;
        if (item.tokens.length > 0) {
          const firstToken = item.tokens[0];
          if (firstToken.type === 'paragraph') {
            modified = true;

            firstToken.text = checkbox + ' ' + firstToken.text;
            if (firstToken.tokens && firstToken.tokens.length > 0) {
              const innerFirst = firstToken.tokens[0];
              if (innerFirst.type === 'text') {
                innerFirst.text = checkbox + ' ' + innerFirst.text;
              }
            }
          }
        }
        if (!modified) {
          item.tokens.unshift({
            type: 'text',
            raw: checkbox + ' ',
            text: checkbox + ' '
          });
        }
      } else {
        text += checkbox + ' ';
      }
    }

    text += this.getParser().parse(item.tokens);

    const transform = compose(this.config.listitem, this.transform);
    const isNested = text.indexOf('\n') !== -1;
    if (isNested) text = text.trim();

    // Use BULLET_POINT as a marker for ordered or unordered list item
    return '\n' + BULLET_POINT + transform(text);
  }

  checkbox(token: Tokens.Checkbox): string {
    return '[' + (token.checked ? 'X' : ' ') + '] ';
  }

  paragraph(token: Tokens.Paragraph): string {
    let text = this.getParser().parseInline(token.tokens);
    const transform = compose(this.config.paragraph, this.transform);
    text = transform(text);

    if (this.config.reflowText) {
      text = reflowText(
        text,
        this.config.width,
        this.getMarkedOptions().gfm ?? false
      );
    }

    return section(text);
  }

  table(token: Tokens.Table): string {
    const headerCells = token.header.map((cell) =>
      this.getParser().parseInline(cell.tokens)
    );

    const table = new Table({
      ...this.tableSettings,
      head: headerCells
    });

    for (const row of token.rows) {
      const cells = row.map((cell) =>
        this.transform(this.getParser().parseInline(cell.tokens))
      );
      table.push(cells);
    }

    return section(this.config.table(table.toString()));
  }

  strong(token: Tokens.Strong): string {
    const text = this.getParser().parseInline(token.tokens);
    return this.config.strong(text);
  }

  em(token: Tokens.Em): string {
    let text = this.getParser().parseInline(token.tokens);
    text = fixHardReturn(text, this.config.reflowText);
    return this.config.em(text);
  }

  codespan(token: Tokens.Codespan): string {
    const text = fixHardReturn(token.text, this.config.reflowText);
    return this.config.codespan(text.replace(/:/g, COLON_REPLACER));
  }

  br(_token: Tokens.Br): string {
    return this.config.reflowText ? HARD_RETURN : '\n';
  }

  del(token: Tokens.Del): string {
    const text = this.getParser().parseInline(token.tokens);
    return this.config.del(text);
  }

  link(token: Tokens.Link): string {
    const href = token.href;
    const text = this.getParser().parseInline(token.tokens);

    if (this.config.sanitize) {
      try {
        const prot = decodeURIComponent(href)
          .replace(/[^\w:]/g, '')
          .toLowerCase();
        if (prot.startsWith('javascript:')) {
          return '';
        }
      } catch {
        return '';
      }
    }

    const hasText = text !== '' && text !== href;
    let out = '';

    if (supportsHyperlinks.stdout) {
      const linkText = text ? this.emojiFn(text) : href;
      const styledLink = this.config.href(linkText);
      out = ansiEscapes.link(styledLink, href.replace(/\+/g, '%20'));
    } else {
      if (hasText) out += this.emojiFn(text) + ' (';
      out += this.config.href(href);
      if (hasText) out += ')';
    }

    return this.config.link(out);
  }

  image(token: Tokens.Image): string {
    if (this.config.image !== undefined) {
      return this.config.image(token.href, token.title, token.text);
    }
    let out = '![' + token.text;
    if (token.title) out += ' – ' + token.title;
    return out + '](' + token.href + ')\n';
  }

  def(_token: Tokens.Def): string {
    return '';
  }
}

// === Export ===

export default Renderer;

export function markedTerminal(
  options?: Partial<TerminalRendererOptions>,
  highlightOptions?: HighlightOptions
): MarkedExtension<string, string> {
  const r = new Renderer(options, highlightOptions);

  const renderer: RendererObject<string, string> = {
    space() {
      r.setContext(this.parser, this.options);
      return '';
    },
    text(token) {
      r.setContext(this.parser, this.options);
      return r.text(token);
    },
    code(token) {
      r.setContext(this.parser, this.options);
      return r.code(token);
    },
    blockquote(token) {
      r.setContext(this.parser, this.options);
      return r.blockquote(token);
    },
    html(token) {
      r.setContext(this.parser, this.options);
      return r.html(token);
    },
    heading(token) {
      r.setContext(this.parser, this.options);
      return r.heading(token);
    },
    hr(token) {
      r.setContext(this.parser, this.options);
      return r.hr(token);
    },
    list(token) {
      r.setContext(this.parser, this.options);
      return r.list(token);
    },
    listitem(token) {
      r.setContext(this.parser, this.options);
      return r.listitem(token);
    },
    checkbox(token) {
      r.setContext(this.parser, this.options);
      return r.checkbox(token);
    },
    paragraph(token) {
      r.setContext(this.parser, this.options);
      return r.paragraph(token);
    },
    table(token) {
      r.setContext(this.parser, this.options);
      return r.table(token);
    },
    strong(token) {
      r.setContext(this.parser, this.options);
      return r.strong(token);
    },
    em(token) {
      r.setContext(this.parser, this.options);
      return r.em(token);
    },
    codespan(token) {
      r.setContext(this.parser, this.options);
      return r.codespan(token);
    },
    br(token) {
      r.setContext(this.parser, this.options);
      return r.br(token);
    },
    del(token) {
      r.setContext(this.parser, this.options);
      return r.del(token);
    },
    link(token) {
      r.setContext(this.parser, this.options);
      return r.link(token);
    },
    image(token) {
      r.setContext(this.parser, this.options);
      return r.image(token);
    },
    def(token) {
      r.setContext(this.parser, this.options);
      return r.def(token);
    }
  };

  return { renderer };
}

// === Helper Functions ===

function textLength(str: string): number {
  return str.replace(ANSI_REGEXP, '').length;
}

function fixHardReturn(text: string, reflow: boolean): string {
  return reflow ? text.replace(HARD_RETURN_RE, '\n') : text;
}

function reflowText(text: string, width: number, gfm: boolean): string {
  const splitRe = gfm ? HARD_RETURN_GFM_RE : HARD_RETURN_RE;
  const sections = text.split(splitRe);
  const reflowed: string[] = [];

  for (const sectionStr of sections) {
    const fragments = sectionStr.split(/(\x1b\[(?:\d{1,3})(?:;\d{1,3})*m)/g);
    let column = 0;
    let currentLine = '';
    let lastWasEscapeChar = false;

    while (fragments.length > 0) {
      const fragment = fragments[0];

      if (fragment === '') {
        fragments.splice(0, 1);
        lastWasEscapeChar = false;
        continue;
      }

      if (textLength(fragment) === 0) {
        currentLine += fragment;
        fragments.splice(0, 1);
        lastWasEscapeChar = true;
        continue;
      }

      const words = fragment.split(/[ \t\n]+/);

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const addSpace = column !== 0 && !lastWasEscapeChar;

        if (column + word.length + (addSpace ? 1 : 0) > width) {
          if (word.length <= width) {
            reflowed.push(currentLine);
            currentLine = word;
            column = word.length;
          } else {
            const available = width - column - (addSpace ? 1 : 0);
            const head = word.substring(0, available);
            if (addSpace) currentLine += ' ';
            currentLine += head;
            reflowed.push(currentLine);
            currentLine = '';
            column = 0;

            let remaining = word.substring(head.length);
            while (remaining.length > 0) {
              const chunk = remaining.substring(0, width);
              if (chunk.length === 0) break;

              if (chunk.length < width) {
                currentLine = chunk;
                column = chunk.length;
                break;
              } else {
                reflowed.push(chunk);
                remaining = remaining.substring(width);
              }
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

      fragments.splice(0, 1);
    }

    if (textLength(currentLine) > 0) reflowed.push(currentLine);
  }

  return reflowed.join('\n');
}

function indentLines(indent: string, text: string): string {
  return text.replace(/(^|\n)(.+)/g, '$1' + indent + '$2');
}

function identify(indent: string, text: string): string {
  if (!text) return text;
  return indent + text.split('\n').join('\n' + indent);
}

// Prevents nested lists from joining their parent list's last line
function fixNestedLists(body: string, indent: string): string {
  const regex = new RegExp(
    '(\\S(?: |  )?)' + // Last char of current point, plus one or two spaces
      // to allow trailing spaces
      '((?:' +
      indent +
      ')+)' + // Indentation of sub point
      '(' +
      POINT_REGEX +
      '(?:.*)+)$',
    'gm'
  ); // Body of sub point
  return body.replace(regex, '$1\n' + indent + '$2$3');
}

function isPointedLine(line: string, indent: string): boolean {
  return new RegExp('^(?:' + indent + ')*' + POINT_REGEX).test(line);
}

function toSpaces(str: string): string {
  return ' '.repeat(str.length);
}

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
  return n + '. ';
}

function numberedLine(
  indent: string,
  line: string,
  num: number
): { num: number; line: string } {
  if (isPointedLine(line, indent)) {
    return {
      num: num + 1,
      line: line.replace(BULLET_POINT, numberedPoint(num + 1))
    };
  }
  return {
    num: num,
    line: toSpaces(numberedPoint(num)) + line
  };
}

function numberedLines(lines: string, indent: string): string {
  let num = 0;
  return lines
    .split('\n')
    .filter(identity)
    .map((line) => {
      const result = numberedLine(indent, line, num);
      num = result.num;
      return result.line;
    })
    .join('\n');
}

function list(body: string, ordered: boolean, indent: string): string {
  const trimmed = body.trim();
  return ordered
    ? numberedLines(trimmed, indent)
    : bulletPointLines(trimmed, indent);
}

function section(text: string): string {
  return text + '\n\n';
}

function highlight(
  code: string,
  language: string | undefined,
  opts: TerminalRendererOptions,
  highlightOpts: HighlightOptions
): string {
  if (chalk.level === 0) return code;

  const style = opts.code;
  code = fixHardReturn(code, opts.reflowText);

  try {
    const cliOpts: HighlightOptions = { ...highlightOpts };
    if (language !== undefined) {
      cliOpts.language = language;
    }
    return highlightCli(code, cliOpts);
  } catch {
    return style(code);
  }
}

function insertEmojis(text: string): string {
  return text.replace(/:([A-Za-z0-9_\-+]+?):/g, (emojiString) => {
    const emojiSign = emoji.get(emojiString);
    if (emojiSign === undefined) return emojiString;
    return emojiSign + ' ';
  });
}

function hr(inputHrStr: string, length: number | false): string {
  const cols = length || process.stdout.columns || 80;
  return new Array(cols).join(inputHrStr);
}

function undoColon(str: string): string {
  return str.replace(COLON_REPLACER_REGEXP, ':');
}

function escapeRegExp(str: string): string {
  return str.replace(/[-[\]{}()*+?./\\^$|]/g, '\\$&');
}

function unescapeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function identity(str: string): string {
  return str;
}

function compose(
  ...funcs: Array<(text: string) => string>
): (text: string) => string {
  return (input: string): string => {
    let result = input;
    for (let i = funcs.length - 1; i >= 0; i--) {
      result = funcs[i](result);
    }
    return result;
  };
}

function isAllowedTabString(str: string): boolean {
  return TAB_ALLOWED_CHARACTERS.some((char) =>
    new RegExp('^(' + char + ')+$').test(str)
  );
}

function sanitizeTab(tab: number | string, fallbackTab: number): string {
  if (typeof tab === 'number') {
    return ' '.repeat(tab);
  } else if (typeof tab === 'string' && isAllowedTabString(tab)) {
    return tab;
  }
  return ' '.repeat(fallbackTab);
}

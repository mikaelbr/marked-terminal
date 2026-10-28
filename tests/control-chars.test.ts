import { Marked } from 'marked';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markedTerminal, type TerminalRendererOptions } from '../src/index.ts';

// Control characters (other than \t and \n) that must never reach the
// terminal from untrusted Markdown input.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/;

const ESC = '\u001b';
const BEL = '\u0007';
const CSI = '\u009b';
const PAYLOAD = `${ESC}]0;PWNED${BEL}${CSI}2J${ESC}[31m`;

// Remove the escape sequences marked-terminal itself emits (SGR colours
// and OSC 8 hyperlinks) so only injected sequences remain.
function stripOwnEscapes(str: string): string {
  return (
    str
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes
      .replace(/\u001b\[[\d;]*m/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes
      .replace(/\u001b\]8;;[^\u0007\u001b]*\u0007/g, '')
  );
}

function render(str: string, options?: TerminalRendererOptions): string {
  const marked = new Marked(markedTerminal(options), { gfm: true });
  return stripOwnEscapes(marked.parse(str) as string);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const cases: Record<string, string> = {
  paragraph: `Hello ${PAYLOAD} world`,
  heading: `# Title ${PAYLOAD}`,
  'second heading': `## Title ${PAYLOAD}`,
  strong: `**bold ${PAYLOAD}**`,
  em: `*em ${PAYLOAD}*`,
  del: `~~del ${PAYLOAD}~~`,
  codespan: `Some \`code ${PAYLOAD}\``,
  'code block': `\`\`\`\ncode ${PAYLOAD}\n\`\`\``,
  'code block with lang': `\`\`\`js\nvar a = "${PAYLOAD}";\n\`\`\``,
  'indented code': `    code ${PAYLOAD}`,
  blockquote: `> quote ${PAYLOAD}`,
  list: `* item ${PAYLOAD}\n* other`,
  'task list': `- [ ] item ${PAYLOAD}`,
  table: `| a | b |\n|---|---|\n| ${PAYLOAD} | x |`,
  'table header': `| a${PAYLOAD} | b |\n|---|---|\n| y | x |`,
  'html block': `<div>\n${PAYLOAD}\n</div>`,
  'inline html': `a <span>${PAYLOAD}</span> b`,
  'link text': `[text ${PAYLOAD}](http://example.com)`,
  'link href': `<http://example.com/${PAYLOAD}>`,
  'link href with text': `[text](<http://example.com/${PAYLOAD}>)`,
  'link title': `[text](http://example.com "${PAYLOAD}")`,
  'image href': `![alt](<http://example.com/${PAYLOAD}>)`,
  'image alt': `![alt ${PAYLOAD}](http://example.com)`,
  'image title': `![alt](http://example.com "${PAYLOAD}")`
};

describe.each(['0', '3'])(
  'Control characters in input (FORCE_COLOR=%s)',
  (forceColor) => {
    it.each(Object.entries(cases))(
      'should strip control characters from %s',
      (_, markdown) => {
        vi.stubEnv('FORCE_COLOR', forceColor);
        const out = render(markdown);
        expect(CONTROL_RE.test(out), JSON.stringify(out)).toBe(false);
      }
    );

    it.each(Object.entries(cases))(
      'should strip control characters from %s (reflow)',
      (_, markdown) => {
        vi.stubEnv('FORCE_COLOR', forceColor);
        const out = render(markdown, { reflowText: true, width: 20 });
        expect(CONTROL_RE.test(out), JSON.stringify(out)).toBe(false);
      }
    );

    it('should keep the surrounding text', () => {
      vi.stubEnv('FORCE_COLOR', forceColor);
      expect(render(`Hello ${ESC}]0;x${BEL} world`).trim()).toBe(
        'Hello ]0;x world'
      );
    });

    it('should keep tabs and newlines in code blocks', () => {
      vi.stubEnv('FORCE_COLOR', forceColor);
      expect(render('```\na\tb\nc\n```')).toContain('a\tb\n');
    });
  }
);

describe('Control characters in input', () => {
  it('should pass sanitized arguments to custom image option', () => {
    let args: unknown[] = [];
    const payload = `${ESC}c${BEL}${CSI}31m`;
    render(`![alt${payload}](<http://x/${payload}> "t${payload}")`, {
      image: (...imageArgs) => {
        args = imageArgs;
        return '';
      }
    });
    expect(args).toHaveLength(3);
    for (const arg of args) {
      expect(CONTROL_RE.test(String(arg)), JSON.stringify(arg)).toBe(false);
    }
  });
});

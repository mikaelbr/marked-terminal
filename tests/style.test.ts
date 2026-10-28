import { Marked } from 'marked';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markedTerminal } from '../src/index.ts';
import { shouldColorize, style } from '../src/style.ts';
import { renderExtension as render } from './helpers.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('colors', () => {
  it('should respect FORCE_COLOR', () => {
    vi.stubEnv('FORCE_COLOR', '1');
    expect(shouldColorize()).toBe(true);
    expect(style(['red', 'bold'])('x')).toBe(
      '\u001b[31m\u001b[1mx\u001b[22m\u001b[39m'
    );

    vi.stubEnv('FORCE_COLOR', '0');
    expect(shouldColorize()).toBe(false);
    expect(style(['red', 'bold'])('x')).toBe('x');
  });

  it('should respect NO_COLOR', () => {
    vi.stubEnv('FORCE_COLOR', undefined);
    vi.stubEnv('NO_COLOR', '1');
    expect(shouldColorize()).toBe(false);
  });

  it('should style default output when colors are enabled', () => {
    vi.stubEnv('FORCE_COLOR', '1');
    expect(render('**bold**')).toContain('\u001b[1mbold\u001b[22m');
  });

  it('should not style default output when colors are disabled', () => {
    vi.stubEnv('FORCE_COLOR', '0');
    expect(render('**bold** `code`')).toBe('bold code\n\n');
  });
});

describe('syntax highlighting', () => {
  const code = '```js\nconst a = "x";\n```';

  it('should highlight known languages', () => {
    vi.stubEnv('FORCE_COLOR', '1');
    const out = render(code);
    expect(out).toContain('\u001b[34mconst\u001b[39m');
    expect(out).toContain('\u001b[31m"x"\u001b[39m');
  });

  it('should fall back to the code style for unknown languages', () => {
    vi.stubEnv('FORCE_COLOR', '1');
    const out = render('```nope\nfoo\n```', {
      code: (text) => `<${text}>`
    });
    expect(out).toBe('    <foo>\n\n');
  });

  it('should accept a custom sheet', () => {
    vi.stubEnv('FORCE_COLOR', '1');
    const marked = new Marked(
      markedTerminal({}, { sheet: { keyword: (text) => `[${text}]` } })
    );
    expect(marked.parse(code)).toBe('    [const] a = "x";\n\n');
  });

  it('should not highlight when colors are disabled', () => {
    vi.stubEnv('FORCE_COLOR', '0');
    expect(render(code)).toBe('    const a = "x";\n\n');
  });
});

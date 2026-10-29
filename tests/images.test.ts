import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { Marked } from 'marked';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectProtocol } from '../src/images/detect.ts';
import { loadImage } from '../src/images/load.ts';
import { fitColumns, iterm2, kitty } from '../src/images/native.ts';
import { markedTerminal, type TerminalRendererOptions } from '../src/index.ts';
import { plainOptions } from './helpers.ts';

// Encode RGBA pixels as an unfiltered PNG
function png(width: number, height: number, rgba: number[]): Buffer {
  const chunk = (name: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(name), data])));
    return Buffer.concat([length, Buffer.from(name), data, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4;
  const rows = Array.from({ length: height }, (_, y) =>
    Buffer.from([0, ...rgba.slice(y * stride, (y + 1) * stride)])
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const PNG = png(2, 2, [...RED, ...RED, ...BLUE, ...BLUE]);
// 4 columns and 2 rows of half blocks at its natural size
const WIDE = png(
  40,
  40,
  Array(40 * 40)
    .fill(RED)
    .flat()
);
// 20x20 pixels, so 2 columns and 1 row
const GIF = Buffer.from(
  'R0lGODlhFAAUAPAAAP8AAAAAACH5BAAAAAAALAAAAAAUABQAAAIRhI+py+0Po5y02ouz3rz7rxUAOw==',
  'base64'
);

const baseDir = mkdtempSync(join(tmpdir(), 'marked-terminal-'));
writeFileSync(join(baseDir, 'img.png'), PNG);
writeFileSync(join(baseDir, 'wide.png'), WIDE);
writeFileSync(join(baseDir, 'img.gif'), GIF);
writeFileSync(join(baseDir, 'text.png'), 'not an image');

const load = { baseDir, remote: false, maxBytes: 1024 };

// stdout is a pipe in tests, so pretend it's a terminal
const stdout = process.stdout as { isTTY?: boolean };
const originalIsTTY = stdout.isTTY;

afterEach(() => {
  stdout.isTTY = originalIsTTY;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('loadImage', () => {
  it('should load paths relative to the base directory', async () => {
    expect(await loadImage('img.png', load)).toEqual(PNG);
    expect(await loadImage('./img.png', load)).toEqual(PNG);
  });

  it('should load file URLs and data URIs', async () => {
    const url = pathToFileURL(join(baseDir, 'img.png')).href;
    expect(await loadImage(url, load)).toEqual(PNG);
    const dataUri = `data:image/png;base64,${PNG.toString('base64')}`;
    expect(Buffer.from((await loadImage(dataUri, load)) ?? [])).toEqual(PNG);
  });

  it('should not load missing or too large files', async () => {
    expect(await loadImage('missing.png', load)).toBeUndefined();
    expect(
      await loadImage('img.png', { ...load, maxBytes: 10 })
    ).toBeUndefined();
  });

  it('should not fetch remote images unless allowed', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array(PNG)));
    vi.stubGlobal('fetch', fetch);
    expect(await loadImage('https://example.com/a.png', load)).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();

    const remote = { ...load, remote: true };
    expect(
      Buffer.from((await loadImage('https://example.com/a.png', remote)) ?? [])
    ).toEqual(PNG);
    fetch.mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(
      await loadImage('https://example.com/a.png', remote)
    ).toBeUndefined();
  });

  it('should not load other URL schemes', async () => {
    expect(await loadImage('ftp://example.com/a.png', load)).toBeUndefined();
  });
});

describe('native protocols', () => {
  it('should size images naturally, within the width', () => {
    expect(fitColumns(2, 80)).toBe(1);
    expect(fitColumns(400, 80)).toBe(40);
    expect(fitColumns(4000, 80)).toBe(80);
  });

  it('should send PNGs to kitty, sized in columns', () => {
    expect(kitty(PNG, 3)).toBe(
      `\u001b_Ga=T,f=100,c=3,q=2,m=0;${PNG.toString('base64')}\u001b\\`
    );
  });

  it('should split kitty data into chunks', () => {
    const out = kitty(new Uint8Array(4000), 20);
    expect(out.split('\u001b_G')).toHaveLength(3);
    expect(out).toContain('c=20,q=2,m=1;');
    expect(out).toContain('\u001b_Gq=2,m=0;');
  });

  it('should send images to iTerm2', () => {
    expect(iterm2(PNG, 3)).toBe(
      `\u001b]1337;File=inline=1;size=${PNG.length};width=3;preserveAspectRatio=1:${PNG.toString('base64')}\u0007`
    );
  });
});

describe('detectProtocol', () => {
  function terminal(env: Record<string, string>, isTTY = true) {
    for (const name of [
      'TERM_PROGRAM',
      'TERM_PROGRAM_VERSION',
      'LC_TERMINAL',
      'KITTY_WINDOW_ID',
      'GHOSTTY_RESOURCES_DIR',
      'WEZTERM_PANE',
      'KONSOLE_VERSION',
      'TMUX',
      'STY',
      'TERM'
    ]) {
      vi.stubEnv(name, env[name] ?? '');
    }
    vi.stubEnv('FORCE_COLOR', '3');
    stdout.isTTY = isTTY;
  }

  it.each([
    ['kitty', { KITTY_WINDOW_ID: '1' }],
    ['kitty', { TERM_PROGRAM: 'ghostty' }],
    ['iterm2', { TERM_PROGRAM: 'iTerm.app', TERM_PROGRAM_VERSION: '3.6.2' }],
    ['iterm2', { TERM_PROGRAM: 'vscode', TERM_PROGRAM_VERSION: '1.95.0' }],
    ['ansi', { TERM: 'xterm-256color' }],
    ['ansi', { KITTY_WINDOW_ID: '1', TMUX: '/tmp/tmux' }],
    // Started from Ghostty or Kitty, which set variables these inherit
    [
      'ansi',
      {
        TERM_PROGRAM: 'zed',
        GHOSTTY_RESOURCES_DIR: '/Applications/Ghostty.app'
      }
    ],
    ['ansi', { TERM_PROGRAM: 'Apple_Terminal', KITTY_WINDOW_ID: '1' }]
  ])('should pick %s for %j', (protocol, env) => {
    terminal(env);
    expect(detectProtocol()).toBe(protocol);
  });

  it('should not draw images when not in a terminal or without colors', () => {
    terminal({ KITTY_WINDOW_ID: '1' }, false);
    expect(detectProtocol()).toBeUndefined();
    terminal({ KITTY_WINDOW_ID: '1' });
    vi.stubEnv('FORCE_COLOR', '0');
    expect(detectProtocol()).toBeUndefined();
  });
});

describe('images option', () => {
  const options: TerminalRendererOptions = {
    ...plainOptions,
    images: { protocol: 'kitty', baseDir }
  };
  const drawn = kitty(PNG, 1);

  const render = (markdown: string, opts = options) =>
    new Marked(markedTerminal(opts)).parse(markdown) as Promise<string>;
  const text = (markdown: string) =>
    new Marked(markedTerminal(plainOptions)).parse(markdown) as string;

  it('should draw images in place of the text', async () => {
    expect(await render('![alt](img.png)')).toBe(`${drawn}\n\n`);
  });

  it('should indent text after an image to the image', async () => {
    expect(await render('* item ![alt](img.png) after')).toBe(
      `* item ${drawn}\n       after\n\n`
    );
  });

  it('should not be broken up by reflowing', async () => {
    const out = await render('Some text ![alt](img.png) more text', {
      ...options,
      reflowText: true,
      width: 10
    });
    expect(out).toContain(drawn);
  });

  it('should show images as text when they can not be drawn', async () => {
    expect(await render('![alt](missing.png)')).toBe(
      text('![alt](missing.png)')
    );
    expect(await render('![alt](text.png)')).toBe(text('![alt](text.png)'));
    const table = '| a |\n|---|\n| ![alt](img.png) |';
    expect(await render(table)).toBe(text(table));
  });

  it('should render the same as without images when not in a terminal', async () => {
    stdout.isTTY = false;
    const markdown = '# Title\n\n* item ![alt](img.png) after';
    const piped = { ...plainOptions, images: { baseDir } };
    expect(await render(markdown, piped)).toBe(text(markdown));
  });

  describe('pixelated', () => {
    const ansi = { ...options, images: { protocol: 'ansi' as const, baseDir } };

    it('should draw half blocks indented to the image', async () => {
      const lines = (await render('> ![alt](wide.png)', ansi)).split('\n');
      expect(lines.slice(0, 2)).toEqual(['    ▄▄▄▄', '    ▄▄▄▄']);
    });

    it('should be indented with list items', async () => {
      expect(await render('* ![alt](wide.png)', ansi)).toBe(
        '* ▄▄▄▄\n  ▄▄▄▄\n\n'
      );
      expect(await render('* item\n\n  ![alt](wide.png)', ansi)).toBe(
        '* item\n  ▄▄▄▄\n  ▄▄▄▄\n\n'
      );
    });

    it('should shrink to fit the width left after indentation', async () => {
      const narrow = {
        ...ansi,
        images: { protocol: 'ansi' as const, baseDir, width: 4 }
      };
      expect(await render('* ![alt](wide.png)', narrow)).toBe('* ▄▄\n\n');
    });

    it('should be used for formats kitty can not draw', async () => {
      expect(await render('![alt](img.gif)')).toBe('▄▄\n\n');
    });
  });
});

import { stripVTControlCharacters } from 'node:util';
import { imageDimensionsFromData } from 'image-dimensions';
import type { Token, Tokens } from 'marked';
import { detectProtocol, type ImageProtocol } from './detect.ts';
import { loadImage } from './load.ts';
import { fitColumns, iterm2, kitty } from './native.ts';

export type { ImageProtocol } from './detect.ts';

/** Options for drawing images in the terminal. */
export interface ImageOptions {
  /**
   * How to draw images. Detected from stdout when not set, where images are
   * only drawn in a terminal and shown as text when piped.
   */
  protocol?: ImageProtocol;
  /** Directory relative image paths are resolved from. Defaults to cwd. */
  baseDir?: string;
  /**
   * Fetch http(s) images. Off by default, so rendering untrusted Markdown
   * doesn't make network requests.
   */
  remote?: boolean;
  /** Largest image to load, in bytes. Defaults to 10 MB. */
  maxBytes?: number;
  /** Maximum width in columns. Defaults to the output width. */
  width?: number;
}

export interface Images {
  /** Loads images ahead of rendering, as marked renders synchronously. */
  walkTokens(token: Token): Promise<void> | undefined;
  /**
   * Returns a placeholder for a loaded image, or `fallback` when it isn't
   * loaded. Placeholders survive reflowing and styling, unlike the escape
   * sequences they are replaced with.
   */
  render(token: Tokens.Image, fallback: string): string;
  /** Replaces the placeholders in the rendered output with the images. */
  place(output: string): Promise<string>;
}

interface LoadedImage {
  protocol: ImageProtocol;
  data: Uint8Array;
  width: number;
}

const MAX_BYTES = 10 * 1024 * 1024;
// Private use characters around the image's id. Kept short, as reflowing
// splits words longer than the width. Markdown can't inject escape codes
// with them, at most repeat one of its own images.
const PLACEHOLDER = /\uE000(\d+)\uE001/;

/** Create image handling for output that is `width` columns wide. */
export function createImages(options: ImageOptions, width: number): Images {
  const protocol = options.protocol ?? detectProtocol();
  const maxColumns = Math.min(options.width ?? width, width);
  const load = {
    baseDir: options.baseDir ?? process.cwd(),
    remote: options.remote ?? false,
    maxBytes: options.maxBytes ?? MAX_BYTES
  };
  const loaded = new WeakMap<Token, LoadedImage>();
  // Keyed by id rather than index, so parses can overlap
  const placed = new Map<number, { image: LoadedImage; fallback: string }>();
  let nextId = 0;

  async function loadToken(token: Tokens.Image, protocol: ImageProtocol) {
    const data = await loadImage(token.href, load);
    // Also makes sure only images are sent to the terminal
    const info = data && imageDimensionsFromData(data);
    if (!data || !info) return;
    // Kitty only draws PNGs as is, other formats are pixelated
    const kittyPng = protocol !== 'kitty' || info.type === 'png';
    loaded.set(token, {
      protocol: kittyPng ? protocol : 'ansi',
      data,
      width: info.width
    });
  }

  // Draw the image where its placeholder is, sized to the columns left of
  // the line, with continuation lines and following text indented to it.
  async function placeLine(line: string): Promise<string> {
    const match = PLACEHOLDER.exec(line);
    const id = Number(match?.[1]);
    const entry = placed.get(id);
    if (!match || !entry) return line;
    placed.delete(id);

    const before = line.slice(0, match.index);
    const after = line.slice(match.index + match[0].length);
    const indent = stripVTControlCharacters(before).replace(/[^\t]/g, ' ');
    const available =
      maxColumns - indent.replaceAll('\t', ' '.repeat(8)).length;
    const columns = fitColumns(entry.image.width, Math.max(available, 1));
    const image = (await draw(entry.image, columns)) ?? entry.fallback;

    let out = before + image.replaceAll('\n', `\n${indent}`);
    if (stripVTControlCharacters(after).trim()) {
      out += `\n${await placeLine(indent + after.trimStart())}`;
    }
    return out;
  }

  return {
    walkTokens(token) {
      if (token.type !== 'image' || !protocol) return;
      return loadToken(token as Tokens.Image, protocol);
    },

    render(token, fallback) {
      const image = loaded.get(token);
      if (!image) return fallback;
      const id = nextId++;
      placed.set(id, { image, fallback });
      return `\uE000${id}\uE001`;
    },

    async place(output) {
      if (!PLACEHOLDER.test(output)) return output;
      const lines = await Promise.all(output.split('\n').map(placeLine));
      return lines.join('\n');
    }
  };
}

async function draw(
  image: LoadedImage,
  columns: number
): Promise<string | undefined> {
  if (image.protocol === 'kitty') return kitty(image.data, columns);
  if (image.protocol === 'iterm2') return iterm2(image.data, columns);
  return pixelate(image.data, columns);
}

// Pixelated with colored half blocks. Loaded on demand, as it pulls in an
// image decoder.
async function pixelate(
  data: Uint8Array,
  columns: number
): Promise<string | undefined> {
  try {
    const { default: terminalImage } = await import('terminal-image');
    return await terminalImage.buffer(data, {
      width: columns,
      preferNativeRender: false
    });
  } catch {
    // Formats the decoder doesn't support
    return undefined;
  }
}

import { styleText } from 'node:util';

/** A function that styles a piece of text, e.g. by wrapping it in ANSI escapes. */
export type StyleFn = (text: string) => string;

type Format = Parameters<typeof styleText>[0];

// Decide on color support ourselves rather than relying on styleText's
// built-in stream validation, which behaves differently across Node.js
// versions (and is skipped for array formats on some of them).
// Evaluated per call so changes to the environment are respected.
export function shouldColorize(): boolean {
  const { env } = process;
  if ('FORCE_COLOR' in env) {
    return env.FORCE_COLOR !== '0' && env.FORCE_COLOR !== 'false';
  }
  if ('NO_COLOR' in env || 'NODE_DISABLE_COLORS' in env) return false;
  return process.stdout?.hasColors?.() ?? false;
}

// Styles are applied per line (like chalk), so indentation added to
// multiline output afterwards isn't styled as well.
export function style(format: Format): StyleFn {
  return (text) =>
    shouldColorize()
      ? text
          .split(/(\r?\n)/)
          .map((part, i) =>
            i % 2 ? part : styleText(format, part, { validateStream: false })
          )
          .join('')
      : text;
}

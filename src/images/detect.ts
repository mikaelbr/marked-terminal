import { createSupportsTerminalGraphics } from 'supports-terminal-graphics';
import { shouldColorize } from '../style.ts';

/**
 * How images are drawn: natively with the Kitty or iTerm2 protocol, or
 * pixelated with colored characters.
 */
export type ImageProtocol = 'kitty' | 'iterm2' | 'ansi';

// `TERM_PROGRAM` values of terminals that support graphics
const GRAPHICS_TERMINALS = [
  'ghostty',
  'iterm.app',
  'kitty',
  'mintty',
  'rio',
  'vscode',
  'warpterminal',
  'wezterm'
];

/**
 * Pick the best way to draw images on stdout, or `undefined` when they
 * can't be drawn (e.g. when output is piped).
 */
export function detectProtocol(): ImageProtocol | undefined {
  const { env, stdout } = process;
  if (!stdout?.isTTY || !shouldColorize()) return undefined;

  // Terminals started from another one, like editors' built-in terminals,
  // inherit variables such as GHOSTTY_RESOURCES_DIR. TERM_PROGRAM is set by
  // the terminal itself, so it decides when set.
  const program = env.TERM_PROGRAM?.toLowerCase();
  const inherited = program && !GRAPHICS_TERMINALS.includes(program);

  // Graphics only pass through tmux and screen when configured to, and are
  // then placed unreliably
  if (!inherited && !env.TMUX && !env.STY) {
    const support = createSupportsTerminalGraphics(stdout);
    // iTerm2 reports Kitty support, but renders its own protocol more reliably
    if (support.iterm2 && env.TERM_PROGRAM === 'iTerm.app') return 'iterm2';
    if (support.kitty) return 'kitty';
    if (support.iterm2) return 'iterm2';
  }
  return 'ansi';
}

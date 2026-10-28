import {
  type HighlightOptions,
  highlight as highlightCli
} from 'cli-highlight';
import { type StyleFn, shouldColorize } from './style.ts';

export type { HighlightOptions };

export function highlight(
  code: string,
  language: string | undefined,
  fallback: StyleFn,
  options: HighlightOptions
): string {
  if (!shouldColorize()) return code;

  try {
    return highlightCli(code, { language, ...options });
  } catch {
    return fallback(code);
  }
}

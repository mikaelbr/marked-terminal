import chalk from 'chalk';
import {
  type HighlightOptions,
  highlight as highlightCli
} from 'cli-highlight';
import type { StyleFn } from './style.ts';

export type { HighlightOptions };

export function highlight(
  code: string,
  language: string | undefined,
  fallback: StyleFn,
  options: HighlightOptions
): string {
  if (chalk.level === 0) return code;

  try {
    return highlightCli(code, { language, ...options });
  } catch {
    return fallback(code);
  }
}

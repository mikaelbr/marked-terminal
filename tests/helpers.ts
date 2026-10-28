import { readFileSync } from 'node:fs';
import { stripVTControlCharacters } from 'node:util';
import { Marked } from 'marked';
import { markedTerminal, type TerminalRendererOptions } from '../src/index.ts';

export const identity = (text: string): string => text;

const styleOptions = [
  'code',
  'blockquote',
  'html',
  'heading',
  'firstHeading',
  'hr',
  'listitem',
  'table',
  'paragraph',
  'strong',
  'em',
  'codespan',
  'del',
  'link',
  'href'
] as const;

/** Options with every style function replaced by identity. */
export const plainOptions: TerminalRendererOptions = Object.fromEntries(
  styleOptions.map((opt) => [opt, identity])
);

export type Render = (
  markdown: string,
  options?: TerminalRendererOptions,
  markedOptions?: { gfm?: boolean }
) => string;

export const render: Render = (markdown, options, markedOptions) =>
  new Marked(markedTerminal(options), markedOptions ?? {}).parse(
    markdown
  ) as string;

export function stripTermEsc(str: string): string {
  return stripVTControlCharacters(str);
}

export function getFixtureFile(fileName: string): string {
  return readFileSync(new URL(`fixtures/${fileName}`, import.meta.url), 'utf8');
}

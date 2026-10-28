import { readFileSync } from 'node:fs';
import { marked } from 'marked';
import { markedTerminal } from '../src/index.ts';

// Example showing usage information from a CLI tool.
marked.use(markedTerminal());

console.log(
  marked.parse(readFileSync(new URL('usage.md', import.meta.url), 'utf8'))
);

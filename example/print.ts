import { readFileSync } from 'node:fs';
import { marked } from 'marked';
import { markedTerminal } from '../src/index.ts';

// Example printing a Markdown file passed as argument, defaulting to the README.
const file = process.argv[2] ?? new URL('../README.md', import.meta.url);

marked.use(markedTerminal());

console.log(marked.parse(readFileSync(file, 'utf8')));

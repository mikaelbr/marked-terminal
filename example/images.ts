import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { markedTerminal } from '../src/index.ts';

// Example drawing images in the terminal. Pass a protocol ('kitty',
// 'iterm2' or 'ansi') as argument to override the detected one.
const protocol = process.argv[2] as 'kitty' | 'iterm2' | 'ansi' | undefined;

marked.use(
  markedTerminal({
    images: {
      baseDir: fileURLToPath(new URL('.', import.meta.url)),
      protocol,
      width: 60
    }
  })
);

console.log(
  await marked.parse(
    readFileSync(new URL('images.md', import.meta.url), 'utf8')
  )
);

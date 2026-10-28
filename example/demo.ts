import { styleText } from 'node:util';
import { marked } from 'marked';
import { markedTerminal } from '../src/index.ts';

marked.use(
  markedTerminal({
    // Change style for code
    codespan: (text) => styleText(['underline', 'magenta'], text),
    emoji: true,

    // Can also override color/styling by own functions.
    firstHeading: (text) => `*** ${text}`
  })
);

console.log(
  marked.parse(
    '# Hello \n\nThis is **markdown** printed in the `terminal` :+1:'
  )
);

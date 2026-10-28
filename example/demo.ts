import chalk from 'chalk';
import { marked } from 'marked';
import { markedTerminal } from '../src/index.ts';

marked.use(
  markedTerminal({
    // Change style for code
    codespan: chalk.underline.magenta,
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

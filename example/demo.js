import marked from 'marked';
import { readFileSync } from 'fs';
import TerminalRenderer from '../index.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Example showing usage information from a CLI tool.

marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer()
});

// Show the parsed data
console.log(
  marked(
    readFileSync(
      dirname(fileURLToPath(import.meta.url)) + '/usage.md'
    ).toString()
  )
);

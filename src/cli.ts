#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const MAX_DEFAULT_WIDTH = 100;

const usage = `Usage: mt [options] [file ...]

Render Markdown to the terminal. Reads from stdin when no file is given,
or when file is "-".

Options:
  -f, --file <path>       Markdown file to render (same as passing it as an argument)
  -w, --width <columns>   Width to wrap text and tables at
                          (default: terminal width, at most ${MAX_DEFAULT_WIDTH})
      --no-reflow         Don't wrap text and tables to the width
      --color             Force colors, even when not writing to a terminal
      --no-color          Disable colors (also respects NO_COLOR)
      --no-emoji          Don't replace :emoji: codes with emojis
      --no-section-prefix Don't prefix headings with #
  -h, --help              Show this help
  -v, --version           Show version

Examples:
  mt README.md
  cat CHANGELOG.md | mt --width 60
  pnpm dlx marked-terminal README.md
`;

function fail(message: string): never {
  process.stderr.write(`mt: ${message}\n\nRun "mt --help" for usage.\n`);
  process.exit(1);
}

function parse() {
  try {
    return parseArgs({
      allowPositionals: true,
      allowNegative: true,
      options: {
        file: { type: 'string', short: 'f', multiple: true },
        width: { type: 'string', short: 'w' },
        reflow: { type: 'boolean', default: true },
        color: { type: 'boolean' },
        emoji: { type: 'boolean', default: true },
        'section-prefix': { type: 'boolean', default: true },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' }
      }
    });
  } catch (error) {
    fail((error as Error).message);
  }
}

function parseWidth(width: string | undefined): number {
  if (width === undefined) {
    return Math.min(process.stdout.columns || 80, MAX_DEFAULT_WIDTH);
  }
  const columns = Number(width);
  if (!Number.isInteger(columns) || columns < 1) {
    fail(`invalid width '${width}', expected a positive integer`);
  }
  return columns;
}

function read(file: string): string {
  try {
    return readFileSync(file === '-' ? process.stdin.fd : file, 'utf8');
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code ?? error;
    fail(`cannot read '${file}': ${reason}`);
  }
}

const { values, positionals } = parse();

if (values.help) {
  process.stdout.write(usage);
  process.exit(0);
}

if (values.version) {
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  );
  process.stdout.write(`${pkg.version}\n`);
  process.exit(0);
}

const files = [...(values.file ?? []), ...positionals];
if (!files.length) {
  // Don't wait for input typed into the terminal, show help instead
  if (process.stdin.isTTY) {
    process.stderr.write(usage);
    process.exit(1);
  }
  files.push('-');
}

const width = parseWidth(values.width);

// Color support is read from the environment, so set it before loading
// the renderer.
if (values.color !== undefined) {
  process.env.FORCE_COLOR = values.color ? '1' : '0';
}

const [{ Marked }, { markedTerminal }] = await Promise.all([
  import('marked'),
  import('./index.ts')
]);

const marked = new Marked(
  markedTerminal({
    reflowText: values.reflow,
    width,
    emoji: values.emoji,
    showSectionPrefix: values['section-prefix'],
    hyperlinks: values.color === false ? false : undefined,
    tab: 2
  })
);

// Exit quietly when the output is closed early, e.g. piped to `head`
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const output = files
  .map((file) => (marked.parse(read(file)) as string).trimEnd())
  .join('\n\n');
process.stdout.write(`${output}\n`);

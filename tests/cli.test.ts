import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const fixture = fileURLToPath(new URL('fixtures/e2e.md', import.meta.url));

function mt(args: string[], input = '', env: NodeJS.ProcessEnv = {}) {
  const { FORCE_COLOR: _, NO_COLOR: __, ...parentEnv } = process.env;
  return spawnSync(process.execPath, [cli, ...args], {
    input,
    encoding: 'utf8',
    env: { ...parentEnv, ...env }
  });
}

describe('cli', () => {
  it('should render Markdown from stdin', () => {
    const { stdout, status } = mt([], '# Hello\n\nThis is **markdown**');
    expect(status).toBe(0);
    expect(stdout).toBe('# Hello\n\nThis is markdown\n');
  });

  it('should render files given as arguments or with --file', () => {
    const fromArg = mt([fixture]);
    const fromFlag = mt(['--file', fixture]);
    expect(fromArg.status).toBe(0);
    expect(fromArg.stdout).toContain('Sometimes you want numbered lists:');
    expect(fromFlag.stdout).toBe(fromArg.stdout);
  });

  it('should read stdin when file is "-"', () => {
    expect(mt(['-'], '# Hi').stdout).toBe('# Hi\n');
  });

  it('should reflow text to the given width', () => {
    const { stdout } = mt(['-w', '10'], 'one two three four');
    expect(stdout).toBe('one two\nthree four\n');
  });

  it('should not reflow with --no-reflow', () => {
    const { stdout } = mt(['-w', '10', '--no-reflow'], 'one two three four');
    expect(stdout).toBe('one two three four\n');
  });

  it('should support disabling emoji and section prefixes', () => {
    const { stdout } = mt(['--no-emoji', '--no-section-prefix'], '# Hi :tada:');
    expect(stdout).toBe('Hi :tada:\n');
  });

  it('should force or disable colors', () => {
    expect(mt(['--color'], '# Hi').stdout).toContain('\u001b[');
    expect(
      mt(['--no-color'], '# Hi', { FORCE_COLOR: '1' }).stdout
    ).not.toContain('\u001b[');
  });

  it('should respect NO_COLOR', () => {
    expect(mt([], '# Hi', { NO_COLOR: '1' }).stdout).toBe('# Hi\n');
  });

  it('should print help and version', () => {
    expect(mt(['--help']).stdout).toContain('Usage: mt');
    expect(mt(['-v']).stdout).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should fail on missing files and invalid options', () => {
    const missing = mt(['does-not-exist.md']);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("cannot read 'does-not-exist.md'");

    expect(mt(['--width', '0']).status).toBe(1);
    expect(mt(['--unknown']).status).toBe(1);
  });
});

import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'es',
      // sourcemap: true,
    },
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      exports: 'named',
      // sourcemap: true,
    },
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
    }),
    commonjs(),
    nodeResolve({
      exportConditions: ['node'],
      preferBuiltins: true,
    }),
  ],
  external: [
    'chalk',
    'cli-table3',
    'cli-highlight',
    'node-emoji',
    'supports-hyperlinks',
    'ansi-escapes',
    'ansi-regex',
    'marked',
    'node:process',
    'node:tty',
    'node:os',
  ],
};

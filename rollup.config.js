import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'index.js',
  output: {
    file: 'index.cjs',
    format: 'cjs',
    name: 'marked-terminal',
    exports: 'auto'
  },
  plugins: [
    commonjs(),
    nodeResolve({
      exportConditions: ['node'],
      preferBuiltins: true
    })
  ],
  external: [
    // keep cjs deps as external; only bundle esm ones
    'cli-table3',
    'cardinal',
    'node-emoji',
    'supports-hyperlinks',
    'node:process',
    'node:tty',
    'node:os'
  ]
};

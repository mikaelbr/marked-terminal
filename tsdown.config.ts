import { defineConfig, type UserConfig } from 'tsdown';

const config: UserConfig = defineConfig({
  entry: 'src/index.ts',
  format: 'esm',
  platform: 'node',
  target: 'node22.12',
  dts: true,
  sourcemap: true,
  fixedExtension: false
});

export default config;

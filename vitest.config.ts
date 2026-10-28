import { defineConfig, type ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: { FORCE_HYPERLINK: '0' }
  }
});

export default config;

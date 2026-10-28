import { defineConfig, type ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: { FORCE_HYPERLINK: '0' },
    typecheck: { enabled: true, include: ['tests/**/*.test-d.ts'] }
  }
});

export default config;

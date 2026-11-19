import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // test/fixtures holds a sample project to scan, including its own *.test.ts files.
    include: ['src/**/*.test.ts'],
  },
});

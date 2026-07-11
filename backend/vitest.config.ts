import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Connect to a live DB only when TEST_DATABASE_URL is provided.
    // Tests that need a DB skip themselves when it is unset.
    env: {
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
  },
});

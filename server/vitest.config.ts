import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        fileParallelism: false, // Prevent shared DB race conditions
        include: ['tests/**/*.test.ts'],
        exclude: ['**/dist/**', '**/node_modules/**'],
    },
});

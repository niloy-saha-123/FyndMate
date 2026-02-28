import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      'react-native': resolve(__dirname, 'tests/mocks/react-native.ts'),
      'expo-router': resolve(__dirname, 'tests/mocks/expo-router.ts'),
      'expo-constants': resolve(__dirname, 'tests/mocks/expo-constants.ts'),
      'expo-image': resolve(__dirname, 'tests/mocks/expo-image.ts'),
      'expo-linear-gradient': resolve(__dirname, 'tests/mocks/expo-linear-gradient.ts'),
      '@expo/vector-icons': resolve(__dirname, 'tests/mocks/expo-vector-icons.ts'),
      'expo-notifications': resolve(__dirname, 'tests/mocks/expo-notifications.ts'),
      'expo-location': resolve(__dirname, 'tests/mocks/expo-location.ts'),
      'expo-secure-store': resolve(__dirname, 'tests/mocks/expo-secure-store.ts'),
      'expo-task-manager': resolve(__dirname, 'tests/mocks/expo-task-manager.ts'),
      'expo-web-browser': resolve(__dirname, 'tests/mocks/expo-web-browser.ts'),
      'expo-auth-session': resolve(__dirname, 'tests/mocks/expo-auth-session.ts'),
      'expo-device': resolve(__dirname, 'tests/mocks/expo-device.ts'),
      'expo-crypto': resolve(__dirname, 'tests/mocks/expo-crypto.ts'),
      'expo-random': resolve(__dirname, 'tests/mocks/expo-random.ts'),
    },
  },
});

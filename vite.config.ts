import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { exclude: [...configDefaults.exclude, 'releases/**'], environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], restoreMocks: true },
});

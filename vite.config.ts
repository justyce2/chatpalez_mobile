import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022'
  },
  server: {
    host: true
  }
});

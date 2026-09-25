import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2019'
  },
  server: {
    host: true
  }
});

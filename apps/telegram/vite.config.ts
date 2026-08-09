import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appDir, '../..');

export default defineConfig({
  root: appDir,
  build: { outDir: 'dist', emptyOutDir: true },
  server: { host: true, port: 5174, fs: { allow: [repoRoot] } }
});

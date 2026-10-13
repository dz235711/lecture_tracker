import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

export default defineConfig({
  publicDir: false,
  build: {
    target: 'node24', outDir: 'desktop-dist', minify: false, ssr: 'server/index.mjs',
    rollupOptions: { external: [...builtinModules, ...builtinModules.map(name => `node:${name}`), 'vite'], output: { entryFileNames: 'server.mjs' } },
  },
});

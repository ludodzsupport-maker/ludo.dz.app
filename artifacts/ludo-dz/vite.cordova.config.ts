import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Dedicated build config for packaging the game into a Cordova/Monaca
// "www" bundle for mobile app store distribution.
//
// This is intentionally a SEPARATE file from vite.config.ts so it can never
// be picked up by the live artifact's dev server or its production deploy
// build — both of those explicitly reference vite.config.ts by name, and
// nothing here is referenced by them.
//
// Run with: pnpm --filter @workspace/ludo-dz run build:cordova
// Output:   <repo root>/cordova/www
//
// When you're ready to actually wrap this in Cordova/Monaca, scaffold the
// project shell (config.xml, platforms/, plugins/) inside /cordova so the
// packaging concern stays fully separate from the pnpm workspace — see
// cordova/README.md.

export default defineConfig({
  // Cordova serves assets from the local filesystem (file://), so paths
  // must be relative rather than absolute.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, '..', '..', 'cordova', 'www'),
    emptyOutDir: true,
  },
});

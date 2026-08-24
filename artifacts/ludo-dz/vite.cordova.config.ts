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
    // Vite's default build target is "baseline-widely-available" (current
    // evergreen browsers). Android WebView is a separately-updated system
    // component, so an older/managed device can lag well behind that,
    // fail to parse the emitted syntax, and show nothing -- a JS parse
    // error aborts the whole file with no console access to prove it.
    // "es2015" trades a slightly larger bundle for syntax that's safe on
    // much older WebView versions.
    //
    // Note this only lowers JS *syntax* (e.g. optional chaining, nullish
    // coalescing, class fields). It does NOT change the emitted
    // `<script type="module" crossorigin>` tag -- Vite always outputs ES
    // module scripts for a normal (non-library) build; only
    // @vitejs/plugin-legacy replaces that with a nomodule/SystemJS
    // fallback, and adding a new dependency was out of scope for this
    // fix. If the real failure is the module script itself failing to
    // load (rather than failing to parse), this change won't address it.
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion';
          }
        },
      },
    },
  },
});

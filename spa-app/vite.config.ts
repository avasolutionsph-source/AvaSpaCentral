import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest lets us own the service worker source so we can add
      // a Web Push handler. Workbox still precaches the build manifest via
      // the __WB_MANIFEST placeholder injected into src/sw.ts.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        // The custom SW pulls in workbox-* runtime helpers that bloat past
        // the default 2 MB threshold; loosen to a still-conservative 4 MB.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      includeAssets: ['favicon.png', 'images/**/*'],
      manifest: {
        name: 'Daet Massage & Spa',
        short_name: 'Daet Spa',
        description: 'Daet Massage & Spa - Business Management System',
        theme_color: '#1B5E37',
        background_color: '#ffffff',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        scope: '/',
        // Installed PWA is the employee app — open it straight at /login so
        // logout (which navigates to /login) and cold launches share the
        // same entry point.
        start_url: '/login',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      // Runtime cache strategies + skipWaiting/clientsClaim now live inside
      // src/sw.ts. The runtime config above (injectManifest.globPatterns)
      // controls precaching; everything else is plain Workbox in the SW.
      devOptions: {
        enabled: true, // Enable PWA in development for testing
        type: 'module', // injectManifest mode requires module-type SW in dev
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  },
  // Strip console.log/debug and debugger in production builds (keep console.error/warn for debugging)
  esbuild: {
    drop: mode === 'production' ? ['debugger'] : [],
    pure: mode === 'production' ? ['console.log', 'console.debug'] : []
  },
  // Bundle analysis - generates stats.html after build
  build: {
    // Increase chunk size warning limit (we're optimizing with manual chunks)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Manual chunks to split vendor code and reduce main bundle size
        manualChunks: {
          // React core - loaded on every page
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Chart.js - used in Dashboard and Analytics pages
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          // Date utilities - used across many pages
          'vendor-date': ['date-fns'],
          // PDF generation - only used in Reports page
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          // Supabase - loaded on auth and data sync
          'vendor-supabase': ['@supabase/supabase-js'],
          // Offline storage - loaded early for data persistence
          'vendor-dexie': ['dexie']
        }
      },
      plugins: [
        mode === 'production' && visualizer({
          filename: 'dist/stats.html',
          open: false,
          gzipSize: true,
          brotliSize: true
        })
      ].filter(Boolean)
    }
  }
}))

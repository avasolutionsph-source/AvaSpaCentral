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
      includeAssets: ['Ava transparent.png', 'images/**/*'],
      manifest: {
        name: 'Daet Massage & Spa',
        short_name: 'Daet Spa',
        description: 'Daet Massage & Spa - Business Management System',
        theme_color: '#1B5E37',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
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
      workbox: {
        // Cache all assets including lazy-loaded chunks
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        // SPA fallback - serve index.html for all navigation requests
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Cache JS chunks (for any dynamically imported chunks not in precache)
            urlPattern: /\.js$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'js-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            // Cache CSS files
            urlPattern: /\.css$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'css-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            // Cache API responses (mock API data stored in IndexedDB anyway)
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache images
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            // Cache fonts
            urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true // Enable PWA in development for testing
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  },
  // Strip console.log and debugger in production builds
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : []
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

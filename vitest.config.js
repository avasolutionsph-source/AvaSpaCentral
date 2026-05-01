import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'supabase/functions/**/*.{test,spec}.{js,ts}'
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'src/main.jsx',
        'src/App.jsx'
      ]
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Vitest config — runs frontend unit tests
    environment:    'jsdom',
    globals:         true,
    setupFiles:     ['./tests/unit/setup.js'],
    include:        ['tests/unit/**/*.test.{js,jsx}'],
    coverage: {
      provider:    'v8',
      reporter:    ['text', 'lcov', 'html'],
      include:     ['src/**/*.{js,jsx}'],
      exclude:     ['src/main.jsx', 'src/**/*.spec.*'],
      thresholds: {
        branches:   50,
        functions:  60,
        lines:      60,
        statements: 60,
      },
    },
  },
  build: {
    // Raise the chunk size warning threshold — BlockNote is large by design
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual chunk splitting: keep heavy vendor libs in separate cacheable chunks
        manualChunks: {
          'vendor-react':     ['react', 'react-dom', 'react-router-dom'],
          'vendor-blocknote': ['@blocknote/core', '@blocknote/react', '@blocknote/mantine'],
          'vendor-chart':     ['recharts'],
          'vendor-axios':     ['axios'],
        },
      },
    },
  },
  // Faster HMR in dev
  server: {
    hmr: true,
  },
})

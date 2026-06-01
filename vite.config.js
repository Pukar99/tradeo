import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const APP_VERSION = process.env.npm_package_version ?? '0.0.0'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@':            path.resolve(__dirname, 'src'),
      '@components':  path.resolve(__dirname, 'src/components'),
      '@pages':       path.resolve(__dirname, 'src/pages'),
      '@hooks':       path.resolve(__dirname, 'src/hooks'),
      '@context':     path.resolve(__dirname, 'src/context'),
      '@utils':       path.resolve(__dirname, 'src/utils'),
      '@api':         path.resolve(__dirname, 'src/api'),
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
  },
  test: {
    // Vitest config — runs frontend unit tests
    // Pure math/logic tests need no DOM; 'node' env avoids jsdom ESM conflicts
    environment:    'node',
    globals:         true,
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
          'vendor-lc':        ['lightweight-charts'],
          'vendor-axios':     ['axios'],
        },
      },
    },
  },
  optimizeDeps: {
    // html2canvas is dynamically imported (AuditTab screenshot only) — no pre-bundling needed
  },
  // Faster HMR in dev
  server: {
    hmr: true,
  },
})

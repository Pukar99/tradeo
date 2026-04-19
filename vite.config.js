import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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

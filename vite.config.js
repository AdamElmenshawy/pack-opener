import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/images': {
        target: 'https://ocs-production-public-images.s3.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/images/, '/images')
      }
    }
  }
})
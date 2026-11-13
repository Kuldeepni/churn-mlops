import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
const config = {
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
  },
}
export default defineConfig(config as any)
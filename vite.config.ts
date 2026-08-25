import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /<repo>/, every other host from the root.
  base: process.env.GITHUB_PAGES ? '/jovi-camera-v2/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
  },
})

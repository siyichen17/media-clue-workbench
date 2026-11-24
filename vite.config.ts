import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { aiApiPlugin } from './server/aiPlugin.ts'

export default defineConfig({
  plugins: [react(), aiApiPlugin()],
})

/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    // Scaffold has no domain tests yet; later tasks add them. This keeps the
    // `npm test` command exiting cleanly until then, while a real test failure
    // still exits non-zero.
    passWithNoTests: true,
  },
})

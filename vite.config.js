import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

let commitHash = ''
let commitMessage = ''

try {
  commitHash = process.env.VERCEL_GIT_COMMIT_SHA || execSync('git rev-parse --short HEAD').toString().trim()
  commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE || execSync('git log -1 --pretty=%s').toString().trim()
} catch (e) {
  console.warn('Could not get git commit info')
}

export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __COMMIT_MESSAGE__: JSON.stringify(commitMessage),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'react-vendor': ['react', 'react-dom'],
        }
      }
    }
  }
})

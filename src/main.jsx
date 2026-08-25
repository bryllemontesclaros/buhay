import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './lib/theme.jsx'
import './index.css'

if (typeof window !== 'undefined') {
  const APP_BUILD_VER = '2026-08-25-v33'
  if ('caches' in window) {
    if (localStorage.getItem('takda_build_ver') !== APP_BUILD_VER) {
      localStorage.setItem('takda_build_ver', APP_BUILD_VER)
      caches.keys().then(keys => {
        keys.forEach(k => caches.delete(k))
      })
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.update().catch(() => {})
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' })
              }
            })
          }
        })
      }).catch(() => {})
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)

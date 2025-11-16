import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Before mounting the SPA, check for a temporary `__redirect` query param
// (set by `public/reset-password.html`). If present, decode it and replace
// the browser URL so the SPA boots on the desired path (e.g. `/reset-password?access_token=...`).
try {
  const sp = new URLSearchParams(window.location.search)
  const r = sp.get('__redirect')
  if (r) {
    const decoded = decodeURIComponent(r)
    // Replace the current history entry with the decoded path (clean URL)
    try { window.history.replaceState({}, document.title, decoded) } catch (e) { /* ignore */ }
    // Remove __redirect from the address bar if still present (defensive)
    const cleaned = new URL(window.location.href)
    cleaned.searchParams.delete('__redirect')
    try { window.history.replaceState({}, document.title, cleaned.pathname + cleaned.search + cleaned.hash) } catch (e) { /* ignore */ }
  }
} catch (e) {
  // proceed without blocking the app
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

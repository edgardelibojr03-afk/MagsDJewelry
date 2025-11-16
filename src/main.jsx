import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// If the user landed on a direct SPA route like `/reset-password` (common when
// Supabase redirects to that path with tokens in the fragment), some static
// hosts will serve `index.html` at that path but React Router (BrowserRouter)
// expects a clean pathname. Rewrite the URL to a hash route before the app
// mounts so `ResetPassword.jsx` can read tokens from the hash or query.
try {
  const p = window.location.pathname
  if (p === '/reset-password') {
    const search = window.location.search || ''
    const hash = window.location.hash || ''
    const target = '/#/reset-password' + (search || '') + (hash || '')
    try { window.history.replaceState({}, document.title, target) } catch (e) { /* ignore */ }
  }
} catch (e) {
  // non-fatal
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

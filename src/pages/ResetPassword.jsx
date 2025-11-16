import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'

export default function ResetPassword() {
  const [session, setSession] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const passwordsMatch = password === confirm
  const validLength = password.length >= 6

  const passwordStrength = (p) => {
    let score = 0
    if (p.length >= 6) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    if (score <= 1) return { label: 'Very weak', color: 'bg-red-500', pct: 25 }
    if (score === 2) return { label: 'Weak', color: 'bg-orange-400', pct: 50 }
    if (score === 3) return { label: 'Medium', color: 'bg-yellow-400', pct: 75 }
    return { label: 'Strong', color: 'bg-green-500', pct: 100 }
  }
  const strength = passwordStrength(password)

  useEffect(() => {
    let mounted = true
    const get = async () => {
      // Try to obtain a recovery session from the URL first (handles
      // links that include the access token in the URL fragment or query).
      try {
        // supabase-js v2 exposes `getSessionFromUrl` to parse tokens from
        // the current window location and optionally store the session.
        if (typeof supabase.auth.getSessionFromUrl === 'function') {
          try {
            const { data: urlData, error: urlErr } = await supabase.auth.getSessionFromUrl({ storeSession: true })
            if (urlErr) {
              // Not fatal — we'll still try to read existing session below
              console.debug('getSessionFromUrl error', urlErr.message || urlErr)
            } else if (urlData?.session) {
              if (mounted) setSession(urlData.session)
              // Clean the URL to remove tokens/fragments for aesthetics/security
              try { window.history.replaceState({}, document.title, window.location.pathname + window.location.search) } catch (e) {}
              return
            }
          } catch (e) {
            console.debug('getSessionFromUrl threw', e)
          }
        }

        // Fallback: try to read an existing stored session
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        if (data?.session) {
          setSession(data.session)
          return
        }

        // If no session was found, try a more permissive fallback: some hosts
        // or email clients change whether tokens are placed in the hash or
        // query. Parse both and, if tokens are present, set the session
        // manually so the recovery flow proceeds.
        try {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
          const queryParams = new URLSearchParams(window.location.search)
          const access_token = hashParams.get('access_token') || queryParams.get('access_token')
          const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token')
          if (access_token || refresh_token) {
            try {
              const { data: setData, error: setErr } = await supabase.auth.setSession({ access_token, refresh_token })
              if (setErr) {
                console.debug('setSession error', setErr.message || setErr)
              } else if (setData?.session) {
                if (mounted) setSession(setData.session)
                // Clean the URL to remove sensitive tokens
                try { window.history.replaceState({}, document.title, window.location.pathname + window.location.search) } catch (e) {}
                return
              }
            } catch (e) {
              console.debug('setSession threw', e)
            }
          }
        } catch (e) {
          // ignore parsing errors and continue
        }
      } catch (err) {
        console.debug('session read error', err)
      }
    }
    get()

    // Listen for auth state changes (Supabase will emit PASSWORD_RECOVERY when user returns via recovery link)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      if (newSession) setSession(newSession)
    })

    return () => {
      mounted = false
      try { listener?.subscription?.unsubscribe?.() } catch (e) {}
    }
  }, [])

  const handleSetPassword = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!password || password.length < 6) return setError('Password must be at least 6 characters')
    if (password !== confirm) return setError('Passwords do not match')
    setLoading(true)
    try {
      // If there is a session (Supabase may sign-in user during recovery), we can update the user password
      if (session) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) setError(error.message)
        else {
          setMessage('Your password has been updated. Redirecting to login...')
          // give user a moment to read the confirmation then redirect to login
          setTimeout(() => navigate('/login', { replace: true }), 1200)
        }
      } else {
        // No session available — prompt the user to use the emailed link which should land them here.
        setError('No recovery session detected. Please use the link from your email to open this page.')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Reset password</h2>
        <p className="text-sm text-gray-600 mb-4">Use the form below to set a new password (the recovery link should create a temporary session).</p>

        <form onSubmit={handleSetPassword}>
          <label className="block text-sm text-gray-700">New password</label>
          <div className="relative mb-2">
            <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-3 border rounded pr-10" />
            <button type="button" onClick={()=>setShowPassword(s=>!s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" aria-label={showPassword? 'Hide password':'Show password'}>{showPassword? 'Hide':'Show'}</button>
          </div>
          <div className="mb-3">
            <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
              <div className={`${strength.color} h-2`} style={{ width: `${strength.pct}%` }} />
            </div>
            <div className="text-xs text-gray-600 mt-1">Strength: <span className="font-medium">{strength.label}</span></div>
          </div>

          <label className="block text-sm text-gray-700">Confirm new password</label>
          <div className="relative mb-4">
            <input type={showConfirm ? 'text' : 'password'} required value={confirm} onChange={(e)=>setConfirm(e.target.value)} className="w-full p-3 border rounded pr-10" />
            <button type="button" onClick={()=>setShowConfirm(s=>!s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" aria-label={showConfirm? 'Hide password':'Show password'}>{showConfirm? 'Hide':'Show'}</button>
          </div>
          {!passwordsMatch && confirm.length > 0 && (
            <div className="text-sm text-red-500 mb-3">Passwords do not match</div>
          )}
          {!validLength && password.length > 0 && (
            <div className="text-sm text-red-500 mb-3">Password must be at least 6 characters</div>
          )}

          {error && <p className="text-red-500 mb-3">{error}</p>}
          {message && <p className="text-green-600 mb-3">{message}</p>}

          <div className="flex justify-end gap-2">
            <button type="submit" disabled={loading || !passwordsMatch || !validLength} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60" aria-disabled={loading || !passwordsMatch || !validLength}>Set password</button>
          </div>
        </form>
      </div>
    </div>
  )
}

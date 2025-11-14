import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data?.session ?? null)
      setUser(data?.session?.user ?? null)
      setLoading(false)
    }

    getSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null)
      setUser(newSession?.user ?? null)
    })

    return () => {
      mounted = false
      try {
        // listener is { subscription }
        listener?.subscription?.unsubscribe?.()
      } catch (e) {
        // ignore
      }
    }
  }, [])

  const signIn = async ({ email, password }) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    // set session/user immediately to avoid ProtectedRoute race
    if (result?.data?.session) {
      setSession(result.data.session)
      setUser(result.data.session.user)
    }
    return result
  }

  const signUp = async ({ email, password }) => {
    const result = await supabase.auth.signUp({ email, password })
    if (result?.data?.user) {
      // on signUp there may not be a session yet, but set user if present
      setUser(result.data.user)
    }
    return result
  }

  const signInWithProvider = async (provider) => {
    // Use a configurable redirect URL when available (Vite env or global deploy var).
    // Defaults to the current origin so local dev still works.
    const redirectTo = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_URL)
      ? import.meta.env.VITE_APP_URL
      : (typeof window !== 'undefined' && window.__DEPLOY_URL) ? window.__DEPLOY_URL : (typeof window !== 'undefined' ? window.location.origin : undefined)
    const opts = redirectTo ? { redirectTo } : undefined
    return supabase.auth.signInWithOAuth({ provider, options: opts })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, signInWithProvider }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

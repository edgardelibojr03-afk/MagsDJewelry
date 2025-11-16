import { useState } from 'react'
import { supabase } from '../services/supabaseClient'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      // Use a hash-based redirect so the emailed link lands inside the SPA
      // and doesn't require server-side rewrites.
      const redirectTo = `${window.location.origin}/#/reset-password`
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        setError(error.message)
      } else {
        setMessage('If the email exists, a recovery message has been sent. Check your inbox.')
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
        <h2 className="text-xl font-semibold mb-4">Forgot your password?</h2>
        <p className="text-sm text-gray-600 mb-4">Enter the email associated with your account and we'll send a link to reset your password.</p>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm text-gray-700">Email</label>
          <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full p-3 border rounded mb-4" />

          {error && <p className="text-red-500 mb-3">{error}</p>}
          {message && <p className="text-green-600 mb-3">{message}</p>}

          <div className="flex justify-end gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">Send reset email</button>
          </div>
        </form>
      </div>
    </div>
  )
}

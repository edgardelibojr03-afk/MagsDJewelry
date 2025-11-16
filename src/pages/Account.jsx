import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Account() {
  const { user, signOut } = useAuth()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (user?.user_metadata?.full_name) setFullName(user.user_metadata.full_name)
  }, [user])

  const saveProfile = async (e) => {
    e.preventDefault()
    setStatus('')
    const updates = { data: { full_name: fullName } }
    const { error } = await supabase.auth.updateUser(updates)
    if (error) setStatus(error.message)
    else setStatus('Profile updated')
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setStatus('')
    if (!currentPassword) return setStatus('Please enter your current password')
    if (!password || password.length < 6) return setStatus('New password must be at least 6 characters')

    try {
      // Re-authenticate the user to verify the current password
      const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
      if (signErr) return setStatus('Current password is incorrect')

      // If re-authentication succeeded, update the password
      const { error } = await supabase.auth.updateUser({ password })
      if (error) setStatus(error.message)
      else {
        setStatus('Password updated')
        setPassword('')
        setCurrentPassword('')
      }
    } catch (err) {
      setStatus(err.message || 'Unable to update password')
    }
  }

  const deleteAccount = async () => {
    setStatus('')
    try {
      const secret = window.__ADMIN_SECRET__
      if (!secret) return setStatus('Missing admin secret to delete account')
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ id: user.id })
      })
      const json = await res.json()
      if (json.error) setStatus(json.error)
      else {
        await signOut()
        setStatus('Account deleted')
      }
    } catch (err) {
      setStatus(err.message)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Account</h1>
  {user?.email && <p className="mb-2 text-sm text-gray-700">Email: <span className="font-medium">{user.email}</span></p>}
      {status && <p className="mb-4 text-sm text-gray-700">{status}</p>}

      <form onSubmit={saveProfile} className="bg-white p-4 rounded shadow mb-4">
        <h2 className="font-semibold mb-3">Profile</h2>
        <label className="block text-sm mb-1">Full name</label>
        <input className="w-full border p-2 rounded mb-3" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
      </form>

      <form onSubmit={changePassword} className="bg-white p-4 rounded shadow mb-4">
        <h2 className="font-semibold mb-3">Change password</h2>
        <label className="block text-sm mb-1">Current password</label>
        <input type="password" className="w-full border p-2 rounded mb-3" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        <label className="block text-sm mb-1">New password</label>
        <input type="password" className="w-full border p-2 rounded mb-3" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Update Password</button>
      </form>

      <div className="bg-white p-4 rounded shadow flex justify-between items-center">
        <button onClick={signOut} className="px-4 py-2 rounded bg-gray-200">Log out</button>
        <button onClick={deleteAccount} className="px-4 py-2 rounded bg-red-600 text-white">Delete account</button>
      </div>
    </div>
  )
}

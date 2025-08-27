// src/components/Dashboard.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'

export default function Dashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)
      try {
        // Prefer calling server-side admin endpoint (Vercel). Supply ADMIN_SECRET in the UI via prompt or env.
        const adminSecret = window.__ADMIN_SECRET__
        if (adminSecret) {
          const resp = await fetch('/api/admin/list-users', { headers: { 'x-admin-secret': adminSecret } })
          const json = await resp.json()
          if (json.error) {
            setError(json.error)
            setUsers([])
          } else {
            setUsers(json.users || [])
          }
        } else {
          // fallback RPC (likely not available on anon key)
          const { data, error } = await supabase.rpc('list_users')
          if (error) {
            setError('Unable to list users via anon key. Ensure service_role or admin RPC exists. ' + error.message)
            setUsers([])
          } else {
            setUsers(data || [])
          }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const handleRevoke = async (id) => {
    // revoke all sessions for a user (requires admin privileges)
    try {
      const { error } = await supabase.auth.admin.invalidateUserById(id)
      if (error) setError(error.message)
      else setUsers((u) => u.filter((x) => x.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    // delete user via admin API (requires service role)
    try {
      const { error } = await supabase.auth.admin.deleteUser(id)
      if (error) setError(error.message)
      else setUsers((u) => u.filter((x) => x.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Admin — User Management</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p>Loading users...</p>
      ) : (
        <div className="space-y-4">
          {users.length === 0 ? (
            <div className="bg-white p-4 rounded shadow">
              <p>No users found or insufficient permissions to list users.</p>
              <p className="text-sm text-gray-600">To enable listing, add a secure server-side endpoint using the Supabase service_role key, or implement an RPC that returns user data.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {users.map((u) => (
                <div key={u.id} className="bg-white p-4 rounded shadow flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{u.email}</div>
                    <div className="text-sm text-gray-600">id: {u.id}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRevoke(u.id)} className="px-3 py-1 bg-yellow-400 rounded">Revoke</button>
                    <button onClick={() => handleDelete(u.id)} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
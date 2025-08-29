// src/components/Dashboard.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { fetchUsersFromAdmin, createUserAdmin, updateUserAdmin, deleteUserAdmin } from '../services/adminApi'

export default function Dashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ id: '', email: '', name: '', password: '' })
  const [adminSecret, setAdminSecret] = useState('')

  const fetchUsers = async () => {
    if (!adminSecret) {
      setError('Admin secret required to list users. Deploy on Vercel with ADMIN_SECRET and paste it here.')
      setUsers([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const json = await fetchUsersFromAdmin(adminSecret)
      if (json.error) {
        setError(json.error)
        setUsers([])
      } else {
        const arr = json.users?.users || json.users || []
        setUsers(arr)
      }
    } catch (err) {
      setError(err.message)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Auto-fetch when a secret is entered
    if (adminSecret) fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret])

  const handleDelete = async (id) => {
    try {
      const secret = window.__ADMIN_SECRET__
      if (!secret) return setError('Missing admin secret')
      const res = await deleteUserAdmin(secret, id)
      if (res.error) setError(res.error)
      else setUsers((u) => u.filter((x) => x.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
  const secret = adminSecret
    if (!secret) return setError('Missing admin secret')
    try {
      if (form.id) {
        const res = await updateUserAdmin(secret, { id: form.id, email: form.email || undefined, password: form.password || undefined, name: form.name || undefined })
        if (res.error) setError(res.error)
        else {
          setForm({ id: '', email: '', name: '', password: '' })
          await fetchUsers()
        }
      } else {
        if (!form.email || !form.password) return setError('Email and password required to create user')
        const res = await createUserAdmin(secret, { email: form.email, password: form.password, name: form.name })
        if (res.error) setError(res.error)
        else {
          setForm({ id: '', email: '', name: '', password: '' })
          await fetchUsers()
        }
      }
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Admin — User Management</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="bg-white p-4 rounded shadow mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm mb-1">Admin secret</label>
          <input className="border p-2 rounded w-full" type="password" value={adminSecret} onChange={(e)=>setAdminSecret(e.target.value)} placeholder="Paste ADMIN_SECRET (server-side secret)" />
        </div>
        <button onClick={fetchUsers} className="px-4 py-2 rounded bg-black text-white">Load users</button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className="border p-2 rounded" placeholder="User ID (leave empty to create)" value={form.id} onChange={(e)=>setForm({ ...form, id: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Email" value={form.email} onChange={(e)=>setForm({ ...form, email: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Full name" value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Password" type="password" value={form.password} onChange={(e)=>setForm({ ...form, password: e.target.value })} />
        <div className="md:col-span-4 flex gap-2">
          <button className="px-4 py-2 rounded bg-blue-600 text-white">{form.id ? 'Update User' : 'Create User'}</button>
          <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={()=>setForm({ id: '', email: '', name: '', password: '' })}>Clear</button>
        </div>
      </form>

      {loading ? (
        <p>Loading users...</p>
      ) : (
        <div className="space-y-4">
          {users.length === 0 ? (
            <div className="bg-white p-4 rounded shadow">
              <p>No users found or insufficient permissions to list users.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {users.map((u) => (
                <div key={u.id} className="bg-white p-4 rounded shadow flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{u.email}</div>
                    <div className="text-sm text-gray-600">id: {u.id}</div>
                    {u.user_metadata?.full_name && <div className="text-sm">{u.user_metadata.full_name}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setForm({ id: u.id, email: u.email || '', name: u.user_metadata?.full_name || '', password: '' })} className="px-3 py-1 bg-yellow-400 rounded">Edit</button>
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
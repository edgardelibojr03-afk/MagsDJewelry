// src/components/Dashboard.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { fetchUsersFromAdmin, createUserAdmin, updateUserAdmin, deleteUserAdmin } from '../services/adminApi'

export default function Dashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ id: '', email: '', name: '', password: '', isAdmin: false })
  const [adminSecret, setAdminSecret] = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const json = await fetchUsersFromAdmin(token ? { token } : { secret: (adminSecret || '').trim() })
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
    // Auto-fetch on mount when logged in; if no token available, allow secret as fallback
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = async (id) => {
    try {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const res = await deleteUserAdmin(token ? { token } : { secret: (adminSecret || '').trim() }, id)
      if (res.error) setError(res.error)
      else setUsers((u) => u.filter((x) => x.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggleBlock = async (u) => {
    try {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const res = await updateUserAdmin(token ? { token } : { secret: (adminSecret || '').trim() }, { id: u.id, blocked: !Boolean(u?.app_metadata?.blocked) })
      if (res.error) setError(res.error)
      else {
        setUsers((list) =>
          list.map((x) => (x.id === u.id ? { ...x, app_metadata: { ...(x.app_metadata || {}), blocked: !Boolean(u?.app_metadata?.blocked) } } : x))
        )
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    try {
      if (form.id) {
        const res = await updateUserAdmin(token ? { token } : { secret: (adminSecret || '').trim() }, {
          id: form.id,
          email: form.email || undefined,
          password: form.password || undefined,
          name: form.name || undefined,
          is_admin: !!form.isAdmin
        })
        if (res.error) setError(res.error)
        else {
          setForm({ id: '', email: '', name: '', password: '', isAdmin: false })
          await fetchUsers()
        }
      } else {
        if (!form.email || !form.password) return setError('Email and password required to create user')
  const res = await createUserAdmin(token ? { token } : { secret: (adminSecret || '').trim() }, { email: form.email, password: form.password, name: form.name, is_admin: !!form.isAdmin })
        if (res.error) setError(res.error)
        else {
          setForm({ id: '', email: '', name: '', password: '', isAdmin: false })
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
          <label className="block text-sm mb-1">Admin secret (optional fallback)</label>
          <input className="border p-2 rounded w-full" type="password" value={adminSecret} onChange={(e)=>setAdminSecret(e.target.value)} placeholder="If not logged in as admin, paste ADMIN_SECRET" />
        </div>
        <button onClick={fetchUsers} className="px-4 py-2 rounded bg-black text-white">Load users</button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className="border p-2 rounded" placeholder="Email" value={form.email} onChange={(e)=>setForm({ ...form, email: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Full name" value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Password" type="password" value={form.password} onChange={(e)=>setForm({ ...form, password: e.target.value })} />
        <label className="flex items-center gap-2 md:col-span-4">
          <input type="checkbox" checked={form.isAdmin} onChange={(e)=>setForm({ ...form, isAdmin: e.target.checked })} />
          <span>Make admin</span>
        </label>
        <div className="md:col-span-4 flex gap-2">
          <button className="px-4 py-2 rounded bg-blue-600 text-white">{form.id ? 'Update User' : 'Create User'}</button>
          <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={()=>setForm({ id: '', email: '', name: '', password: '', isAdmin: false })}>Clear</button>
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
                    <div className="font-semibold flex items-center gap-2">
                      {u.email}
                      {u?.app_metadata?.blocked && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Blocked</span>}
                      {(u?.app_metadata?.is_admin || (Array.isArray(u?.app_metadata?.roles) && u.app_metadata.roles.includes('admin'))) && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Admin</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">id: {u.id}</div>
                    {u.user_metadata?.full_name && <div className="text-sm">{u.user_metadata.full_name}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setForm({
                        id: u.id,
                        email: u.email || '',
                        name: u.user_metadata?.full_name || '',
                        password: '',
                        isAdmin: Boolean(u?.app_metadata?.is_admin || (Array.isArray(u?.app_metadata?.roles) && u.app_metadata.roles.includes('admin')))
                      })}
                      className="px-3 py-1 bg-yellow-400 rounded"
                    >
                      Edit
                    </button>
                    <button onClick={() => handleToggleBlock(u)} className="px-3 py-1 bg-gray-200 rounded">
                      {u?.app_metadata?.blocked ? 'Unblock' : 'Block'}
                    </button>
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
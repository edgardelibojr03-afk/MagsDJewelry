// src/components/Dashboard.jsx
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchUsersFromAdmin, createUserAdmin, updateUserAdmin, deleteUserAdmin, adminListReservations } from '../services/adminApi'
import { listItems, createItem, updateItem, deleteItem } from '../services/itemsApi'
import { listReservations } from '../services/reservationsApi'
import { supabase } from '../services/supabaseClient'

export default function Dashboard() {
  const { session, loading: authLoading } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ id: '', email: '', name: '', password: '', isAdmin: false })
  const [tab, setTab] = useState('users')
  const [items, setItems] = useState([])
  const [itemForm, setItemForm] = useState({ id: '', name: '', purchase_price: '', sell_price: '', total_quantity: '', image_url: '' })
  const [itemFile, setItemFile] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [userReservations, setUserReservations] = useState([])
  const [salesTotal, setSalesTotal] = useState(0)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = session?.access_token
      if (!token) {
        setLoading(false)
        setError('Please login as an admin to load users.')
        setUsers([])
        return
      }
      const json = await fetchUsersFromAdmin({ token })
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
    // Fetch when auth is ready and we have a token
    if (!authLoading && session?.access_token) {
  if (tab === 'users') fetchUsers()
  if (tab === 'items') loadItems()
  if (tab === 'sales' && selectedUserId) loadUserReservations(selectedUserId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, tab, selectedUserId])

  const loadUserReservations = async (uid) => {
    if (!uid) return
    setLoading(true)
    setError('')
    try {
      const token = session?.access_token
      if (!token) return setError('Please login as an admin')
      const res = await adminListReservations({ token }, uid)
      if (res.error) {
        setError(res.error)
        setUserReservations([])
        setSalesTotal(0)
      } else {
        setUserReservations(res.reservations || [])
        setSalesTotal(Number(res.total || 0))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = session?.access_token
      if (!token) return setError('Please login as an admin to load items.')
      const res = await listItems({ token })
      if (res.error) setError(res.error)
      else setItems(res.items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
  const token = session?.access_token
  const res = await deleteUserAdmin({ token }, id)
      if (res.error) setError(res.error)
      else setUsers((u) => u.filter((x) => x.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggleBlock = async (u) => {
    try {
  const token = session?.access_token
  const res = await updateUserAdmin({ token }, { id: u.id, blocked: !Boolean(u?.app_metadata?.blocked) })
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
  const token = session?.access_token
    try {
      if (form.id) {
        const res = await updateUserAdmin({ token }, {
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
  const res = await createUserAdmin({ token }, { email: form.email, password: form.password, name: form.name, is_admin: !!form.isAdmin })
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

  const handleItemSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const token = session?.access_token
    try {
      let imageUrl = itemForm.image_url || null
      // If a file is chosen, upload to Supabase Storage and use its public URL
      if (itemFile) {
        const file = itemFile
        const fileName = `${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now()}-${file.name}`
        const path = `items/${fileName}`
        const { error: upErr } = await supabase.storage.from('item-images').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/*'
        })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
        const { data: pub } = supabase.storage.from('item-images').getPublicUrl(path)
        imageUrl = pub?.publicUrl || null
      }

      const payload = {
        name: itemForm.name,
        purchase_price: Number(itemForm.purchase_price || 0),
        sell_price: Number(itemForm.sell_price || 0),
        total_quantity: Number(itemForm.total_quantity || 0),
        image_url: imageUrl
      }
      if (itemForm.id) {
        const res = await updateItem({ token }, { id: itemForm.id, ...payload })
        if (res.error) return setError(res.error)
      } else {
        const res = await createItem({ token }, payload)
        if (res.error) return setError(res.error)
      }
      setItemForm({ id: '', name: '', purchase_price: '', sell_price: '', total_quantity: '', image_url: '' })
      setItemFile(null)
      await loadItems()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleItemDelete = async (id) => {
    const token = session?.access_token
    const res = await deleteItem({ token }, id)
    if (res.error) setError(res.error)
    else setItems((arr) => arr.filter((x) => x.id !== id))
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => setTab('users')} className={`px-3 py-2 rounded ${tab==='users'?'bg-black text-white':'bg-white'}`}>Users</button>
        <button onClick={() => setTab('items')} className={`px-3 py-2 rounded ${tab==='items'?'bg-black text-white':'bg-white'}`}>Items</button>
        <button onClick={() => setTab('sales')} className={`px-3 py-2 rounded ${tab==='sales'?'bg-black text-white':'bg-white'}`}>Sales</button>
      </div>
  <h1 className="text-2xl font-bold mb-4">Admin — {tab === 'users' ? 'User Management' : tab === 'items' ? 'Item Management' : 'Sales Management'}</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {tab === 'users' && (
        <div className="bg-white p-4 rounded shadow mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <button onClick={fetchUsers} className="px-4 py-2 rounded bg-black text-white">Load users</button>
        </div>
      )}
      {tab === 'items' && (
        <div className="bg-white p-4 rounded shadow mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <button onClick={loadItems} className="px-4 py-2 rounded bg-black text-white">Load items</button>
        </div>
      )}
      {tab === 'sales' && (
        <div className="bg-white p-4 rounded shadow mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">Select a user</div>
            <button onClick={fetchUsers} className="px-3 py-1.5 rounded bg-black text-white">Refresh users</button>
          </div>
          {users.length === 0 ? (
            <p className="text-sm text-gray-600">No users found.</p>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-auto">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setSelectedUserId(u.id); loadUserReservations(u.id) }}
                  className={`text-left px-3 py-2 rounded border ${selectedUserId===u.id? 'bg-gray-100 border-gray-400':'bg-white'}`}
                >
                  <div className="font-medium">{u.email}</div>
                  <div className="text-xs text-gray-600">{u.user_metadata?.full_name || '—'} • {u.id}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
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
      )}

      {tab === 'items' && (
      <form onSubmit={handleItemSubmit} className="bg-white p-4 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-6 gap-3">
        <input className="border p-2 rounded" placeholder="Item name" value={itemForm.name} onChange={(e)=>setItemForm({ ...itemForm, name: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Purchase price (₱)" type="number" min="0" step="0.01" value={itemForm.purchase_price} onChange={(e)=>setItemForm({ ...itemForm, purchase_price: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Sell price (₱)" type="number" min="0" step="0.01" value={itemForm.sell_price} onChange={(e)=>setItemForm({ ...itemForm, sell_price: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Quantity" type="number" min="0" step="1" value={itemForm.total_quantity} onChange={(e)=>setItemForm({ ...itemForm, total_quantity: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Image URL (or use Upload)" value={itemForm.image_url} onChange={(e)=>setItemForm({ ...itemForm, image_url: e.target.value })} />
        <input className="border p-2 rounded" type="file" accept="image/*" onChange={(e)=>setItemFile(e.target.files?.[0] || null)} />
        <div className="md:col-span-6 flex gap-2 items-center">
          <button className="px-4 py-2 rounded bg-blue-600 text-white">{itemForm.id ? 'Update Item' : 'Create Item'}</button>
          <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={()=>{ setItemForm({ id: '', name: '', purchase_price: '', sell_price: '', total_quantity: '', image_url: '' }); setItemFile(null) }}>Clear</button>
          {(itemForm.image_url || itemFile) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Preview:</span>
              <img
                src={itemFile ? URL.createObjectURL(itemFile) : itemForm.image_url}
                alt="preview"
                className="w-12 h-12 object-cover rounded border"
              />
            </div>
          )}
        </div>
      </form>
      )}

      {loading ? (
        <p>Loading users...</p>
      ) : (
        <div className="space-y-4">
          {tab === 'users' && (
            users.length === 0 ? (
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
            )
          )}

          {tab === 'items' && (
            items.length === 0 ? (
              <div className="bg-white p-4 rounded shadow">
                <p>No items found.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((it) => (
                  <div key={it.id} className="bg-white p-4 rounded shadow flex gap-4">
                    <img src={it.image_url || '/vite.svg'} alt={it.name} className="w-24 h-24 object-cover rounded" />
                    <div className="flex-1">
                      <div className="font-semibold">{it.name}</div>
                      <div className="text-sm text-gray-600">Qty: {it.total_quantity} • Reserved: {it.reserved_quantity}</div>
                      <div className="text-sm">₱{Number(it.sell_price || 0).toFixed(2)}</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="px-2 py-1 bg-yellow-400 rounded"
                          onClick={() => setItemForm({ id: it.id, name: it.name || '', purchase_price: it.purchase_price || '', sell_price: it.sell_price || '', total_quantity: it.total_quantity || '', image_url: it.image_url || '' })}
                        >
                          Edit
                        </button>
                        <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => handleItemDelete(it.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'sales' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded shadow">
                <div className="font-semibold mb-2">Reservations</div>
                {userReservations.length === 0 ? (
                  <p className="text-sm text-gray-600">No reservations for this user.</p>
                ) : (
                  <div className="grid gap-3">
                    {userReservations.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 border rounded p-2">
                        <img src={r.items?.image_url || '/vite.svg'} alt={r.items?.name || ''} className="w-12 h-12 object-cover rounded" />
                        <div className="flex-1">
                          <div className="font-medium">{r.items?.name || 'Item'}</div>
                          <div className="text-sm text-gray-600">Qty: {r.quantity} • ₱{Number(r.items?.sell_price||0).toFixed(2)}</div>
                        </div>
                        <div className="font-semibold">₱{(Number(r.items?.sell_price||0)*Number(r.quantity||0)).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white p-4 rounded shadow flex items-center justify-between">
                <div className="font-semibold">Total: ₱{Number(salesTotal).toFixed(2)}</div>
                <button
                  disabled={!selectedUserId}
                  onClick={async()=>{
                    const token = session?.access_token
                    const res = await fetch('/api/admin/sales/finalize', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: selectedUserId }) })
                    const json = await res.json()
                    if (json.error) setError(json.error)
                    else {
                      alert(`Sale finalized. Total: ₱${Number(json.total||0).toFixed(2)}`)
                      setUserReservations([])
                      setSalesTotal(0)
                    }
                  }}
                  className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
                >Finalize sale</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
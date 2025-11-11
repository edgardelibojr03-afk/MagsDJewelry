// src/components/Dashboard.jsx
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchUsersFromAdmin, createUserAdmin, updateUserAdmin, deleteUserAdmin, adminListReservations } from '../services/adminApi'
import { listItems, createItem, updateItem, deleteItem, restockItem } from '../services/itemsApi'
import { currency, formatDateTime } from '../utils/format'
import { listReservations } from '../services/reservationsApi'
import { supabase } from '../services/supabaseClient'
import ConfirmModal from '../components/ConfirmModal'

export default function Dashboard() {
  const { session, loading: authLoading } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ id: '', email: '', name: '', password: '', isAdmin: false })
  const [tab, setTab] = useState('users')
  const [items, setItems] = useState([])
  const [itemForm, setItemForm] = useState({ id: '', name: '', description: '', purchase_price: '', sell_price: '', total_quantity: '', image_url: '', status: 'active', discount_type: 'none', discount_value: '', category_type: '', gold_type: '', karat: '', restock_threshold: '' })
  const [itemFile, setItemFile] = useState(null)
  const [restockQtyMap, setRestockQtyMap] = useState({})
  const [itemFilters, setItemFilters] = useState({ q: '', category_type: '', gold_type: '', karat: '' })
  const [showItemFilters, setShowItemFilters] = useState(false)
  const [showOnlyRestock, setShowOnlyRestock] = useState(false)
  const [lowStock, setLowStock] = useState([])
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null })
  const [selectedUserId, setSelectedUserId] = useState('')
  const [userReservations, setUserReservations] = useState([])
  const [salesTotal, setSalesTotal] = useState(0)
  const [lastSaleId, setLastSaleId] = useState('')
  const [recentSales, setRecentSales] = useState([])
  const [userSalesHistory, setUserSalesHistory] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('full')
  const [layawayMonths, setLayawayMonths] = useState(6)

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
      if (tab === 'sales') {
        if (selectedUserId) loadUserReservations(selectedUserId)
        if (selectedUserId) loadUserSalesHistory(selectedUserId)
        loadRecentSales()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, tab, selectedUserId, showOnlyRestock])

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
      const res = await listItems({ token, filters: {
        q: itemFilters.q || undefined,
        category_type: itemFilters.category_type || undefined,
        gold_type: itemFilters.gold_type || undefined,
        karat: itemFilters.karat || undefined
      } })
      if (res.error) setError(res.error)
      else {
        const arr = res.items || []
        setItems(arr)
        // Compute low stock by two criteria:
        // 1) total_quantity <= restock_threshold
        // 2) (reserved_quantity - available) >= restock_threshold
        const lows = arr.filter((it) => {
          const thr = it.restock_threshold != null && it.restock_threshold !== '' ? Number(it.restock_threshold) : null
          if (thr == null) return false
          const total = Number(it.total_quantity || 0)
          const reserved = Number(it.reserved_quantity || 0)
          const available = Math.max(0, total - reserved)
          const deficit = Math.max(0, reserved - available)
          return total <= thr || deficit >= thr
        })
        setLowStock(lows)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadRecentSales = async () => {
    try {
      const token = session?.access_token
      if (!token) return
      const resp = await fetch('/api/admin/sales/history', { headers: { Authorization: `Bearer ${token}` } })
      const json = await resp.json()
      if (!resp.ok || json.error) throw new Error(json.error || `Failed to load sales (${resp.status})`)
      setRecentSales(json.sales || [])
    } catch (e) {
      // swallow errors in background; optional to surface
    }
  }

  const loadUserSalesHistory = async (uid) => {
    try {
      const token = session?.access_token
      if (!token || !uid) return
      const resp = await fetch(`/api/admin/sales/history?user_id=${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await resp.json()
      if (!resp.ok || json.error) throw new Error(json.error || `Failed to load user sales (${resp.status})`)
      setUserSalesHistory(json.sales || [])
    } catch (e) {
      // keep silent in UI unless needed
      setUserSalesHistory([])
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
    // Show confirmation for creating/updating an item
    setConfirm({
      open: true,
      title: itemForm.id ? 'Confirm update' : 'Confirm create',
      message: `Are you sure you want to ${itemForm.id ? 'update' : 'create'} the item "${itemForm.name}"?`,
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }))
        // perform actual submit
        const token = session?.access_token
        try {
          let imageUrl = itemForm.image_url || null
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

          if (Number(itemForm.sell_price || 0) < Number(itemForm.purchase_price || 0)) {
            throw new Error('Sell price cannot be less than purchase price')
          }
          const payload = {
            name: itemForm.name,
            description: itemForm.description || null,
            purchase_price: Number(itemForm.purchase_price || 0),
            sell_price: Number(itemForm.sell_price || 0),
            total_quantity: Number(itemForm.total_quantity || 0),
            image_url: imageUrl,
            status: itemForm.status,
            discount_type: itemForm.discount_type,
            discount_value: Number(itemForm.discount_value || 0),
            category_type: itemForm.category_type || null,
            gold_type: itemForm.gold_type || null,
            karat: itemForm.karat || null,
            restock_threshold: itemForm.restock_threshold === '' ? null : Number(itemForm.restock_threshold)
          }
          if (itemForm.id) {
            const res = await updateItem({ token }, { id: itemForm.id, ...payload })
            if (res.error) return setError(res.error)
          } else {
            const res = await createItem({ token }, payload)
            if (res.error) return setError(res.error)
          }
          setItemForm({ id: '', name: '', purchase_price: '', sell_price: '', total_quantity: '', image_url: '', status: 'active', discount_type: 'none', discount_value: '', category_type: '', gold_type: '', karat: '' })
          setItemFile(null)
          await loadItems()
        } catch (err) {
          setError(err.message)
        }
      }
    })
  }

  const handleItemDelete = async (id) => {
    const token = session?.access_token
    const res = await deleteItem({ token }, id)
    if (res?.error) {
      if (res.code === 'FK_VIOLATION') {
        const ok = window.confirm('This item has existing reservations. Delete those reservations and then delete the item?')
        if (ok) {
          const res2 = await deleteItem({ token }, id, { force: true })
          if (res2?.error) setError(res2.error)
          else await loadItems()
        }
      } else {
        setError(res.error)
      }
    } else {
      setItems((arr) => arr.filter((x) => x.id !== id))
    }
  }

  // If admin toggles "show only restock" we filter the rendered list locally
  const displayedItems = showOnlyRestock ? items.filter((it) => lowStock.some((l) => l.id === it.id)) : items

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => setTab('users')} className={`px-3 py-2 rounded ${tab==='users'?'bg-black text-white':'bg-white'}`}>Users</button>
        <button onClick={() => setTab('items')} className={`px-3 py-2 rounded ${tab==='items'?'bg-black text-white':'bg-white'}`}>
          Items
          {lowStock.length > 0 && (
            <span className="ml-2 inline-block text-xs bg-red-600 text-white rounded-full px-2 py-0.5">{lowStock.length}</span>
          )}
        </button>
        <button onClick={() => setTab('sales')} className={`px-3 py-2 rounded ${tab==='sales'?'bg-black text-white':'bg-white'}`}>Sales</button>
        <button onClick={() => { setTab('history'); loadRecentSales() }} className={`px-3 py-2 rounded ${tab==='history'?'bg-black text-white':'bg-white'}`}>History</button>
      </div>
  <h1 className="text-2xl font-bold mb-4">Admin — {tab === 'users' ? 'User Management' : tab === 'items' ? 'Item Management' : 'Sales Management'}</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {tab === 'users' && (
        <div className="bg-white p-4 rounded shadow mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <button onClick={fetchUsers} className="px-4 py-2 rounded bg-black text-white">Load users</button>
        </div>
      )}
      {tab === 'items' && (
        <>
          <div className="bg-white p-4 rounded shadow mb-2 flex flex-col sm:flex-row gap-3 items-end justify-between">
            <div className="flex-1 sm:mr-4">
              <label className="block text-xs text-gray-600 mb-1">Search</label>
              <input className="border p-2 rounded w-full" placeholder="Search name..." value={itemFilters.q} onChange={(e)=>setItemFilters({ ...itemFilters, q: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=> setShowItemFilters(true)} className="px-4 py-2 rounded bg-gray-200">Filters</button>
              <button onClick={()=>{ setShowOnlyRestock((s)=>!s) }} className={`px-4 py-2 rounded ${showOnlyRestock ? 'bg-red-600 text-white' : 'bg-gray-200'}`}>{showOnlyRestock ? 'Showing restock' : 'Show only restock'}</button>
              <button onClick={loadItems} className="px-4 py-2 rounded bg-black text-white">Apply</button>
              <button onClick={()=>{ setItemFilters({ q:'', category_type:'', gold_type:'', karat:'' }); loadItems(); }} className="px-4 py-2 rounded bg-gray-200">Clear</button>
            </div>
          </div>

          {/* Modal for item filters */}
          {showItemFilters && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black opacity-40" onClick={()=>setShowItemFilters(false)} />
              <div className="bg-white rounded p-6 z-10 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-3">Filters</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Type</label>
                    <select className="border p-2 rounded w-full" value={itemFilters.category_type} onChange={(e)=>setItemFilters({ ...itemFilters, category_type: e.target.value })}>
                      <option value="">All</option>
                      <option value="ring">Ring</option>
                      <option value="bracelet">Bracelet</option>
                      <option value="necklace">Necklace</option>
                      <option value="earrings">Earrings</option>
                      <option value="watch">Watch</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Gold type</label>
                    <select className="border p-2 rounded w-full" value={itemFilters.gold_type} onChange={(e)=>setItemFilters({ ...itemFilters, gold_type: e.target.value })}>
                      <option value="">All</option>
                      <option value="italian">Italian</option>
                      <option value="saudi">Saudi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Karat</label>
                    <select className="border p-2 rounded w-full" value={itemFilters.karat} onChange={(e)=>setItemFilters({ ...itemFilters, karat: e.target.value })}>
                      <option value="">All</option>
                      <option value="10k">10k</option>
                      <option value="14k">14k</option>
                      <option value="18k">18k</option>
                      <option value="21k">21k</option>
                      <option value="24k">24k</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-4 py-2 rounded bg-gray-200" onClick={()=>{ setShowItemFilters(false) }}>Close</button>
                  <button className="px-4 py-2 rounded bg-black text-white" onClick={()=>{ setShowItemFilters(false); loadItems(); }}>Apply</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {tab === 'items' && lowStock.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-3 mb-6">
          <div className="font-semibold mb-2">Low stock alerts</div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {lowStock.map((it)=> (
              <li key={it.id}>{it.name} — Qty {Number(it.total_quantity||0)} (threshold {it.restock_threshold})</li>
            ))}
          </ul>
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
      <form onSubmit={handleItemSubmit} className="bg-white p-4 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-10 gap-3">
        <input className="border p-2 rounded" placeholder="Item name" value={itemForm.name} onChange={(e)=>setItemForm({ ...itemForm, name: e.target.value })} />
        <input className="border p-2 rounded md:col-span-2" placeholder="Short description" value={itemForm.description} onChange={(e)=>setItemForm({ ...itemForm, description: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Purchase price (₱)" type="number" min="0" step="0.01" value={itemForm.purchase_price} onChange={(e)=>setItemForm({ ...itemForm, purchase_price: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Sell price (₱)" type="number" min="0" step="0.01" value={itemForm.sell_price} onChange={(e)=>setItemForm({ ...itemForm, sell_price: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Quantity" type="number" min="0" step="1" value={itemForm.total_quantity} onChange={(e)=>setItemForm({ ...itemForm, total_quantity: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Image URL (or use Upload)" value={itemForm.image_url} onChange={(e)=>setItemForm({ ...itemForm, image_url: e.target.value })} />
        <input className="border p-2 rounded" type="file" accept="image/*" onChange={(e)=>setItemFile(e.target.files?.[0] || null)} />
        <select className="border p-2 rounded" value={itemForm.status} onChange={(e)=>setItemForm({ ...itemForm, status: e.target.value })}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select className="border p-2 rounded" value={itemForm.discount_type} onChange={(e)=>setItemForm({ ...itemForm, discount_type: e.target.value })}>
            <option value="none">No discount</option>
            <option value="percent">% off</option>
            <option value="fixed">Fixed ₱ off</option>
          </select>
          <input className="border p-2 rounded" placeholder="Discount value" type="number" min="0" step="0.01" value={itemForm.discount_value} onChange={(e)=>setItemForm({ ...itemForm, discount_value: e.target.value })} />
        </div>
        <select className="border p-2 rounded" value={itemForm.category_type || ''} onChange={(e)=>setItemForm({ ...itemForm, category_type: e.target.value || '' })}>
          <option value="">Type (optional)</option>
          <option value="ring">Ring</option>
          <option value="bracelet">Bracelet</option>
          <option value="necklace">Necklace</option>
          <option value="earrings">Earrings</option>
          <option value="watch">Watch</option>
        </select>
        <select className="border p-2 rounded" value={itemForm.gold_type || ''} onChange={(e)=>setItemForm({ ...itemForm, gold_type: e.target.value || '' })}>
          <option value="">Gold type</option>
          <option value="italian">Italian</option>
          <option value="saudi">Saudi</option>
        </select>
        <select className="border p-2 rounded" value={itemForm.karat || ''} onChange={(e)=>setItemForm({ ...itemForm, karat: e.target.value || '' })}>
          <option value="">Karat</option>
          <option value="10k">10k</option>
          <option value="14k">14k</option>
          <option value="18k">18k</option>
          <option value="21k">21k</option>
          <option value="24k">24k</option>
        </select>
        <input className="border p-2 rounded" placeholder="Restock threshold (optional)" type="number" min="0" step="1" value={itemForm.restock_threshold} onChange={(e)=>setItemForm({ ...itemForm, restock_threshold: e.target.value })} />
        <div className="md:col-span-6 flex gap-2 items-center">
          <button className="px-4 py-2 rounded bg-blue-600 text-white">{itemForm.id ? 'Update Item' : 'Create Item'}</button>
          <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={()=>{ setItemForm({ id: '', name: '', description: '', purchase_price: '', sell_price: '', total_quantity: '', image_url: '', status: 'active', discount_type: 'none', discount_value: '', category_type: '', gold_type: '', karat: '', restock_threshold: '' }); setItemFile(null) }}>Clear</button>
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
                      <button
                        onClick={() => setConfirm({
                          open: true,
                          title: u?.app_metadata?.blocked ? 'Confirm unblock' : 'Confirm block',
                          message: `Are you sure you want to ${u?.app_metadata?.blocked ? 'unblock' : 'block'} ${u.email}?`,
                          onConfirm: async () => { setConfirm((c)=>({ ...c, open: false })); await handleToggleBlock(u) }
                        })}
                        className="px-3 py-1 bg-gray-200 rounded"
                      >
                        {u?.app_metadata?.blocked ? 'Unblock' : 'Block'}
                      </button>
                      <button onClick={() => setConfirm({ open: true, title: 'Confirm delete', message: `Delete user ${u.email}? This cannot be undone.`, onConfirm: async () => { setConfirm((c)=>({ ...c, open: false })); await handleDelete(u.id) } })} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
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
                {displayedItems.map((it) => (
                  <div key={it.id} className="bg-white p-4 rounded shadow flex gap-4">
                    <img src={it.image_url || '/vite.svg'} alt={it.name} className="w-24 h-24 object-cover rounded" />
                    <div className="flex-1">
                      <div className="font-semibold">{it.name}</div>
                      {(it.category_type || it.gold_type || it.karat) && (
                        <div className="mt-1 flex flex-wrap gap-1 text-xs">
                          {it.category_type && <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">{it.category_type}</span>}
                          {it.gold_type && <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">{it.gold_type}</span>}
                          {it.karat && <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">{it.karat}</span>}
                        </div>
                      )}
                      {/* Restock notification badge */}
                      {(() => {
                        const thr = it.restock_threshold != null && it.restock_threshold !== '' ? Number(it.restock_threshold) : null
                        const total = Number(it.total_quantity || 0)
                        const reserved = Number(it.reserved_quantity || 0)
                        const available = Math.max(0, total - reserved)
                        const deficit = Math.max(0, reserved - available)
                        const needs = thr != null && (total <= thr || deficit >= thr)
                        if (needs) {
                          return (
                            <div className="mt-2">
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Restock needed</span>
                              <span className="ml-2 text-xs text-gray-600">Threshold: {thr} • Qty: {total} • Reserved: {reserved}</span>
                            </div>
                          )
                        }
                        return null
                      })()}
                      <div className="text-sm text-gray-600">Qty: {Number(it.total_quantity||0).toLocaleString()} • Reserved: {Number(it.reserved_quantity||0).toLocaleString()}</div>
                      <div className="text-sm">{currency(it.sell_price)}</div>
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        <button
                          className="px-2 py-1 bg-yellow-400 rounded"
                          onClick={() => setItemForm({
                            id: it.id,
                            name: it.name || '',
                            description: it.description || '',
                            purchase_price: it.purchase_price || '',
                            sell_price: it.sell_price || '',
                            total_quantity: it.total_quantity || '',
                            image_url: it.image_url || '',
                            status: it.status || 'active',
                            discount_type: it.discount_type || 'none',
                            discount_value: (it.discount_value ?? ''),
                            category_type: it.category_type || '',
                            gold_type: it.gold_type || '',
                            karat: it.karat || '',
                            restock_threshold: it.restock_threshold ?? ''
                          })}
                        >
                          Edit
                        </button>
                        <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => setConfirm({ open: true, title: 'Confirm delete', message: `Delete item ${it.name}? This will remove the item from the catalog.`, onConfirm: async () => { setConfirm((c)=>({ ...c, open: false })); await handleItemDelete(it.id) } })}>Delete</button>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={Boolean(it.is_best_seller)}
                                onChange={async (e) => {
                                  try {
                                    const token = session?.access_token
                                    const checked = e.target.checked
                                    const res = await updateItem({ token }, { id: it.id, is_best_seller: checked })
                                    if (res.error) return setError(res.error)
                                    setItems((arr) => arr.map((x) => (x.id === it.id ? res.item : x)))
                                  } catch (err) { setError(err.message) }
                                }}
                              />
                              <span>Best seller</span>
                            </label>
                            <select
                              className="border p-1 rounded w-24"
                              value={it.best_seller_rank ?? ''}
                              onChange={async (e) => {
                                const val = e.target.value
                                try {
                                  const token = session?.access_token
                                  // deselect rank (empty) -> unset best seller and rank
                                  if (val === '') {
                                    const res = await updateItem({ token }, { id: it.id, is_best_seller: false, best_seller_rank: null })
                                    if (res.error) return setError(res.error)
                                    setItems((arr) => arr.map((x) => (x.id === it.id ? res.item : x)))
                                    return
                                  }
                                  const rank = Number(val)
                                  // If another item holds this rank, clear it first
                                  const other = items.find((x) => Number(x.best_seller_rank) === rank && x.id !== it.id)
                                  let otherItem = null
                                  if (other) {
                                    const ro = await updateItem({ token }, { id: other.id, is_best_seller: false, best_seller_rank: null })
                                    if (ro.error) return setError(ro.error)
                                    otherItem = ro.item
                                  }
                                  // Set current item as best seller with selected rank
                                  const res = await updateItem({ token }, { id: it.id, is_best_seller: true, best_seller_rank: rank })
                                  if (res.error) return setError(res.error)
                                  setItems((arr) => arr.map((x) => {
                                    if (x.id === it.id) return res.item
                                    if (otherItem && x.id === otherItem.id) return otherItem
                                    return x
                                  }))
                                } catch (err) { setError(err.message) }
                              }}
                            >
                              <option value="">—</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1 ml-auto">
                          <input
                            type="number"
                            className="border p-1 rounded w-24"
                            placeholder="Restock qty"
                            value={restockQtyMap[it.id] ?? ''}
                            onChange={(e)=> setRestockQtyMap((m)=> ({ ...m, [it.id]: e.target.value }))}
                          />
                          <button
                            className="px-2 py-1 bg-green-600 text-white rounded"
                            onClick={() => setConfirm({ open: true, title: 'Confirm restock', message: `Restock ${it.name} by ${restockQtyMap[it.id] || 0}?`, onConfirm: async () => {
                              setConfirm((c)=>({ ...c, open: false }))
                              const token = session?.access_token
                              const qty = Number(restockQtyMap[it.id] || 0)
                              if (!Number.isFinite(qty) || qty <= 0) { setError('Enter a valid restock quantity'); return }
                              const res = await restockItem({ token }, { id: it.id, quantity: qty })
                              if (res.error) { setError(res.error) }
                              else {
                                setRestockQtyMap((m)=> ({ ...m, [it.id]: '' }))
                                await loadItems()
                              }
                            } })}
                          >Restock</button>
                        </div>
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
                          <div className="text-sm text-gray-600">Qty: {r.quantity} • {currency(r.items?.sell_price||0)}</div>
                          {r.created_at && (
                            <div className="text-xs text-gray-500">Reserved: {formatDateTime(r.created_at)}</div>
                          )}
                        </div>
                        <div className="font-semibold">₱{(Number(r.items?.sell_price||0)*Number(r.quantity||0)).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white p-4 rounded shadow">
                <div className="font-semibold mb-2">Purchase history</div>
                {userSalesHistory.length === 0 ? (
                  <p className="text-sm text-gray-600">No past sales for this user.</p>
                ) : (
                  <div className="grid gap-2 max-h-64 overflow-auto">
                    {userSalesHistory.map((s) => (
                      <div key={s.id} className="flex items-center justify-between border rounded p-2">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {new Date(s.created_at).toLocaleString()}
                            {s.status === 'voided' && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">VOIDED</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600">Sale ID: {s.id}</div>
                          <div className="text-xs text-gray-700 mt-1">
                            Total: {currency(s.total)}{typeof s.refunded_total !== 'undefined' && (
                              <> • Refunded: {currency(s.refunded_total)} • Net: {currency(s.net_total)}</>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async()=>{
                              try {
                                const token = session?.access_token
                                const resp = await fetch(`/api/admin/sales/invoice?sale_id=${encodeURIComponent(s.id)}`, { headers: { Authorization: `Bearer ${token}` } })
                                if (!resp.ok) { const j = await resp.json().catch(()=>({})); throw new Error(j?.error || `Failed (${resp.status})`) }
                                const blob = await resp.blob()
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `invoice_${s.id}.pdf`
                                document.body.appendChild(a)
                                a.click()
                                a.remove()
                                URL.revokeObjectURL(url)
                              } catch (e) { setError(e.message) }
                            }}
                            className="px-3 py-1 bg-indigo-600 text-white rounded"
                          >Invoice</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white p-4 rounded shadow flex items-center justify-between gap-3 flex-wrap">
                <div className="font-semibold">Total: {currency(salesTotal)}</div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">Payment</label>
                  <select className="border p-1 rounded" value={paymentMethod} onChange={(e)=>setPaymentMethod(e.target.value)}>
                    <option value="full">Full</option>
                    <option value="layaway">Layaway</option>
                  </select>
                  {paymentMethod==='layaway' && (
                    <>
                      <label className="text-sm">Months</label>
                      <input type="number" min={6} step={1} className="border p-1 rounded w-20" value={layawayMonths} onChange={(e)=>setLayawayMonths(Number(e.target.value||6))} />
                    </>
                  )}
                </div>
                <button
                  disabled={!selectedUserId}
                  onClick={async()=>{
                    const token = session?.access_token
                    const res = await fetch('/api/admin/sales/finalize', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: selectedUserId, payment_method: paymentMethod, layaway_months: layawayMonths }) })
                    const json = await res.json()
                    if (json.error) setError(json.error)
                    else {
                      alert(`Sale finalized. Total: ₱${Number(json.total||0).toFixed(2)}`)
                      setUserReservations([])
                      setSalesTotal(0)
                      setLastSaleId(json.sale_id || '')
                      loadRecentSales()
                    }
                  }}
                  className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
                >Finalize sale</button>
                <button
                  disabled={!lastSaleId}
                  onClick={async()=>{
                    try {
                      const token = session?.access_token
                      const resp = await fetch(`/api/admin/sales/invoice?sale_id=${encodeURIComponent(lastSaleId)}`, { headers: { Authorization: `Bearer ${token}` } })
                      if (!resp.ok) {
                        const j = await resp.json().catch(()=>({}))
                        throw new Error(j?.error || `Failed to fetch invoice (${resp.status})`)
                      }
                      const blob = await resp.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `invoice_${lastSaleId}.pdf`
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                    } catch (e) {
                      setError(e.message)
                    }
                  }}
                  className="ml-2 px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
                >Download invoice</button>
              </div>
              
            </div>
          )}
          {tab === 'history' && (
            <div className="bg-white p-4 rounded shadow">
              <div className="font-semibold mb-2">Recent sales</div>
              {recentSales.length === 0 ? (
                <p className="text-sm text-gray-600">No recent sales.</p>
              ) : (
                <div className="grid gap-2 max-h-96 overflow-auto">
                  {recentSales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between border rounded p-2">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {new Date(s.created_at).toLocaleString()}
                          {s.status === 'voided' && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">VOIDED</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">Sale ID: {s.id} • User: {s.user_id}</div>
                        <div className="text-xs text-gray-700 mt-1">
                          Total: {currency(s.total)}{typeof s.refunded_total !== 'undefined' && (
                            <> • Refunded: {currency(s.refunded_total)} • Net: {currency(s.net_total)}</>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async()=>{
                            try {
                              const token = session?.access_token
                              const resp = await fetch(`/api/admin/sales/invoice?sale_id=${encodeURIComponent(s.id)}`, { headers: { Authorization: `Bearer ${token}` } })
                              if (!resp.ok) { const j = await resp.json().catch(()=>({})); throw new Error(j?.error || `Failed (${resp.status})`) }
                              const blob = await resp.blob()
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `invoice_${s.id}.pdf`
                              document.body.appendChild(a)
                              a.click()
                              a.remove()
                              URL.revokeObjectURL(url)
                            } catch (e) { setError(e.message) }
                          }}
                          className="px-3 py-1 bg-indigo-600 text-white rounded"
                        >Invoice</button>
                        <button
                          disabled={s.status === 'voided'}
                          onClick={async()=>{
                            const confirmVoid = window.confirm('Void this sale and restock all items? This creates a full refund record.')
                            if (!confirmVoid) return
                            try {
                              const token = session?.access_token
                              const resp = await fetch('/api/admin/sales/refund', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ sale_id: s.id, full: true, reason: 'Admin void' })
                              })
                              const j = await resp.json()
                              if (!resp.ok || j.error) throw new Error(j.error || `Failed (${resp.status})`)
                              await loadRecentSales()
                              await loadItems()
                            } catch (e) { setError(e.message) }
                          }}
                          className={`px-3 py-1 rounded ${s.status === 'voided' ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-red-600 text-white'}`}
                        >Void</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <ConfirmWrapper state={confirm} setState={setConfirm} />
    </div>
  )
}

// Confirmation modal used across critical admin actions
function ConfirmWrapper({ state, setState }) {
  if (!state.open) return null
  const handleConfirm = async () => {
    try {
      if (typeof state.onConfirm === 'function') await state.onConfirm()
    } catch (e) {
      // swallow here; individual handlers will set error state if needed
    } finally {
      setState((s) => ({ ...s, open: false }))
    }
  }
  return (
    <ConfirmModal open={state.open} title={state.title} message={state.message} onConfirm={handleConfirm} onCancel={() => setState((s)=>({ ...s, open: false }))} />
  )
}

export { ConfirmWrapper }
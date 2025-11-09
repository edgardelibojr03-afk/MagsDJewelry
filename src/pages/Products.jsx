import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabaseClient'
import { currency } from '../utils/format'
import { reserveDelta } from '../services/reservationsApi'

export default function Products() {
  const { session, user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [qtyById, setQtyById] = useState({})
  const [filters, setFilters] = useState({ q: '', category_type: '', gold_type: '', karat: '' })
  const [showFilters, setShowFilters] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      // Public read via Supabase client (RLS allows select for anon)
      let q = supabase
        .from('items')
        .select('id, name, sell_price, total_quantity, reserved_quantity, image_url, category_type, gold_type, karat')
        .order('created_at', { ascending: false })
      if (filters.q) q = q.ilike('name', `%${filters.q}%`)
      if (filters.category_type) q = q.eq('category_type', filters.category_type)
      if (filters.gold_type) q = q.eq('gold_type', filters.gold_type)
      if (filters.karat) q = q.eq('karat', filters.karat)
      const { data, error: err } = await q
      if (err) setError(err.message)
      else {
        setItems(data || [])
        // Initialize counters per item
        const q = {}
        for (const it of data || []) {
          q[it.id] = 1
        }
        setQtyById(q)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onReserve = async (id) => {
    if (!user) return setError('Please log in to reserve items')
    const token = session?.access_token
    const qty = Math.max(0, Number(qtyById[id] || 0))
    if (qty <= 0) return
    const res = await reserveDelta({ token }, { item_id: id, delta: qty })
    if (res.error) return setError(res.error)
    // refresh items to reflect reserved_quantity changes and reset counter
    await load()
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Products</h1>
      <div className="bg-white p-4 rounded shadow mb-4 flex flex-col sm:flex-row sm:items-end sm:gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-600 mb-1">Search</label>
          <div className="flex gap-2">
            <input className="border p-2 rounded w-full" placeholder="Search name..." value={filters.q} onChange={(e)=>setFilters({ ...filters, q: e.target.value })} />
            <button type="button" onClick={() => setShowFilters(true)} className="px-4 py-2 rounded bg-gray-200">Filters</button>
          </div>
        </div>
        <div className="mt-3 sm:mt-0 sm:ml-auto flex gap-2">
          <button onClick={load} className="px-4 py-2 rounded bg-black text-white">Search</button>
          <button onClick={()=>{ setFilters({ q:'', category_type:'', gold_type:'', karat:'' }); load() }} className="px-4 py-2 rounded bg-gray-200">Clear</button>
        </div>
      </div>

      {/* Filters modal */}
      {showFilters && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowFilters(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" className="bg-white rounded shadow-lg p-6 z-50 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Filters</h3>
              <button onClick={()=>setShowFilters(false)} className="text-gray-600">Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Type</label>
                <select className="border p-2 rounded w-full" value={filters.category_type} onChange={(e)=>setFilters({ ...filters, category_type: e.target.value })}>
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
                <select className="border p-2 rounded w-full" value={filters.gold_type} onChange={(e)=>setFilters({ ...filters, gold_type: e.target.value })}>
                  <option value="">All</option>
                  <option value="italian">Italian</option>
                  <option value="saudi">Saudi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Karat</label>
                <select className="border p-2 rounded w-full" value={filters.karat} onChange={(e)=>setFilters({ ...filters, karat: e.target.value })}>
                  <option value="">All</option>
                  <option value="10k">10k</option>
                  <option value="14k">14k</option>
                  <option value="18k">18k</option>
                  <option value="21k">21k</option>
                  <option value="24k">24k</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={()=>{ setFilters({ q:filters.q, category_type:'', gold_type:'', karat:'' }); }} className="px-4 py-2 rounded bg-gray-200">Clear</button>
              <button onClick={()=>{ load(); setShowFilters(false); }} className="px-4 py-2 rounded bg-black text-white">Apply</button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => {
            const available = (it.total_quantity || 0) - (it.reserved_quantity || 0)
            const queued = available <= 0
            return (
              <div key={it.id} className="bg-white rounded shadow overflow-hidden">
                <img src={it.image_url || '/vite.svg'} alt={it.name} className="w-full h-56 object-cover" />
                <div className="p-4">
                  <div className="font-semibold text-lg">{it.name}</div>
                  <div className="text-sm text-gray-600">{queued ? 'Queued reservations allowed' : `Available: ${available}`}</div>
                  <div className="text-sm">Price: {currency(it.sell_price || 0)}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                      onClick={() => setQtyById((m) => ({ ...m, [it.id]: Math.max(1, (Number(m[it.id]) || 1) - 1) }))}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      className="w-16 text-center border rounded py-1"
                      value={qtyById[it.id] || 1}
                      onChange={(e) => {
                        const v = Math.max(1, Number(e.target.value || 1))
                        setQtyById((m) => ({ ...m, [it.id]: v }))
                      }}
                    />
                    <button
                      className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                      onClick={() => setQtyById((m) => ({ ...m, [it.id]: (Number(m[it.id]) || 1) + 1 }))}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                    <button
                      className="px-3 py-1 bg-black text-white rounded disabled:opacity-50"
                      onClick={() => onReserve(it.id)}
                      disabled={(qtyById[it.id] || 0) <= 0}
                    >
                      {queued ? 'Queue Reserve' : 'Reserve'}
                    </button>
                  </div>
                  {queued && <div className="mt-2 text-amber-600 text-sm">Currently fully reserved — you will be in queue.</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

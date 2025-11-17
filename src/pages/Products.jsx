import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabaseClient'
import { currency, formatDateTime, countdownTo } from '../utils/format'
import { reserveDelta, listReservations } from '../services/reservationsApi'
import ReserveModal from '../components/ReserveModal'

export default function Products() {
  const { session, user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [qtyById, setQtyById] = useState({})
  const [selectedItem, setSelectedItem] = useState(null)
  const [showReserveModal, setShowReserveModal] = useState(false)
  const [filters, setFilters] = useState({ q: '', category_type: '', gold_type: '', karat: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [userResMap, setUserResMap] = useState({})

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      // Public read via Supabase client (RLS allows select for anon)
      let q = supabase
        .from('items')
        .select('id, name, sell_price, total_quantity, reserved_quantity, image_url, category_type, gold_type, karat, discount_type, discount_value, status')
        .neq('status', 'archived')
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

  // If user is logged in, fetch their reservations to show per-item expiry/countdown
  useEffect(() => {
    let mounted = true
    const loadUserRes = async () => {
      if (!user) { setUserResMap({}); return }
      const token = session?.access_token
      try {
        const res = await listReservations({ token })
        if (res.error) {
          // ignore; keep empty map
        } else {
          const map = {}
          for (const r of (res.reservations || [])) map[r.item_id || r.item?.id] = r
          if (mounted) setUserResMap(map)
        }
      } catch (e) {}
    }
    loadUserRes()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Live search: debounce typing in the search box to auto-run load
  useEffect(() => {
    const t = setTimeout(() => {
      load()
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q])

  const onReserve = async (id, qty) => {
    if (!user) return setError('Please log in to reserve items')
    const token = session?.access_token
    const q = Math.max(0, Number(qty || 0))
    if (q <= 0) return
    const res = await reserveDelta({ token }, { item_id: id, delta: q })
    if (res.error) return setError(res.error)
    // refresh items to reflect reserved_quantity changes
    await load()
    setShowReserveModal(false)
    setSelectedItem(null)
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
            const inactive = String(it.status || 'active') === 'inactive'
            const queued = available <= 0
            return (
              <div key={it.id} className="bg-white rounded shadow overflow-hidden">
                <img src={it.image_url || '/vite.svg'} alt={it.name} className="w-full h-80 object-cover" />
                <div className="p-4">
                  <div className="font-semibold text-lg">{it.name}</div>
                  {(it.category_type || it.gold_type || it.karat) && (
                    <div className="mt-1 flex flex-wrap gap-1 text-xs">
                      {it.category_type && <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">{it.category_type}</span>}
                      {it.gold_type && <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">{it.gold_type}</span>}
                      {it.karat && <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">{it.karat}</span>}
                    </div>
                  )}
                  <div className="text-sm text-gray-600">{queued ? 'Queued reservations allowed' : `Available: ${available}`}</div>
                  {userResMap[it.id] && (
                    <div className="text-xs text-gray-600 mt-1">Reserved: {formatDateTime(userResMap[it.id].created_at)} • {userResMap[it.id].expires_at ? countdownTo(userResMap[it.id].expires_at).text : ''}</div>
                  )}
                  <div className="text-sm">
                    Price: {
                      (it.discount_type && it.discount_value != null && Number(it.discount_value) !== 0)
                      ? (
                        (() => {
                          const oldP = Number(it.sell_price || 0)
                          let newP = oldP
                          let savings = 0
                          let suffix = ''
                          if (String(it.discount_type) === 'percent') {
                            const pct = Number(it.discount_value || 0)
                            newP = Math.max(0, Math.round((oldP * (1 - pct / 100)) * 100) / 100)
                            savings = oldP - newP
                            suffix = ` (${pct}% off)`
                          } else if (String(it.discount_type) === 'fixed') {
                            const amt = Number(it.discount_value || 0)
                            newP = Math.max(0, Math.round((oldP - amt) * 100) / 100)
                            savings = oldP - newP
                            suffix = ` (${currency(savings)} off)`
                          }
                          return (
                            <span>
                              <span className="text-gray-500 line-through mr-2">{currency(oldP)}</span>
                              <span className="font-semibold">{currency(newP)}</span>
                              <span className="ml-2 text-sm text-green-600">{suffix || ` - ${currency(savings)}`}</span>
                            </span>
                          )
                        })()
                      ) : (
                        <span>{currency(it.sell_price || 0)}</span>
                      )
                    }
                  </div>
                    <div className="mt-3">
                      <button
                        className={`px-4 py-2 rounded w-full ${inactive ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-black text-white'}`}
                        onClick={() => { if (!inactive) { setSelectedItem(it); setShowReserveModal(true) } }}
                        disabled={inactive}
                      >
                        {inactive ? 'Unavailable' : (queued ? 'Queue Reserve' : 'Reserve')}
                      </button>
                    </div>
                    {queued && <div className="mt-2 text-amber-600 text-sm">Currently fully reserved — you will be in queue.</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <ReserveModal
        open={showReserveModal}
        item={selectedItem}
        onClose={() => { setShowReserveModal(false); setSelectedItem(null) }}
        onReserve={(qty) => selectedItem && onReserve(selectedItem.id, qty)}
      />
    </div>
  )
}

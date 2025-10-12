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

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      // Public read via Supabase client (RLS allows select for anon)
      const { data, error: err } = await supabase
        .from('items')
        .select('id, name, sell_price, total_quantity, reserved_quantity, image_url')
        .order('created_at', { ascending: false })
      if (err) setError(err.message)
      else {
        setItems(data || [])
        // Initialize counters per item
        const q = {}
        for (const it of data || []) {
          const available = (it.total_quantity || 0) - (it.reserved_quantity || 0)
          q[it.id] = available > 0 ? 1 : 0
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
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => {
            const available = (it.total_quantity || 0) - (it.reserved_quantity || 0)
            const soldOut = available <= 0
            return (
              <div key={it.id} className="bg-white rounded shadow overflow-hidden">
                <img src={it.image_url || '/vite.svg'} alt={it.name} className="w-full h-48 object-cover" />
                <div className="p-4">
                  <div className="font-semibold text-lg">{it.name}</div>
                  <div className="text-sm text-gray-600">Available: {available}</div>
                  <div className="text-sm">Price: {currency(it.sell_price || 0)}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                      onClick={() => setQtyById((m) => ({ ...m, [it.id]: Math.max(1, (Number(m[it.id]) || 1) - 1) }))}
                      disabled={soldOut}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, available)}
                      className="w-16 text-center border rounded py-1"
                      value={qtyById[it.id] || 1}
                      onChange={(e) => {
                        const v = Math.min(Math.max(1, Number(e.target.value || 1)), Math.max(1, available))
                        setQtyById((m) => ({ ...m, [it.id]: v }))
                      }}
                    />
                    <button
                      className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                      onClick={() => setQtyById((m) => ({ ...m, [it.id]: Math.min(Math.max(1, available), (Number(m[it.id]) || 1) + 1) }))}
                      disabled={soldOut}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                    <button
                      className="px-3 py-1 bg-black text-white rounded disabled:opacity-50"
                      onClick={() => onReserve(it.id)}
                      disabled={soldOut || (qtyById[it.id] || 0) <= 0}
                    >
                      Reserve
                    </button>
                  </div>
                  {soldOut && <div className="mt-2 text-red-600 text-sm">Fully reserved</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

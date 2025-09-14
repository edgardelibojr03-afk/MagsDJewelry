import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listItems } from '../services/itemsApi'
import { reserveDelta } from '../services/reservationsApi'

export default function Products() {
  const { session, user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const token = session?.access_token
      const res = await listItems({ token })
      if (res.error) setError(res.error)
      else setItems(res.items || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onReserve = async (id, delta) => {
    if (!user) return setError('Please log in to reserve items')
    const token = session?.access_token
    const res = await reserveDelta({ token }, { item_id: id, delta })
    if (res.error) return setError(res.error)
    // refresh items to reflect reserved_quantity changes
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
                  <div className="text-sm">Price: ₱{Number(it.sell_price || 0).toFixed(2)}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <button className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50" onClick={() => onReserve(it.id, -1)} disabled={soldOut && true}>
                      −
                    </button>
                    <button className="px-3 py-1 bg-black text-white rounded disabled:opacity-50" onClick={() => onReserve(it.id, 1)} disabled={soldOut}>
                      Reserve
                    </button>
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => onReserve(it.id, 1)}>+</button>
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

import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listReservations, reserveDelta, cancelAllReservations } from '../services/reservationsApi'
import { currency, formatDateTime, countdownTo } from '../utils/format'

export default function Cart() {
  const { session, user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const token = session?.access_token
      const res = await listReservations({ token })
      if (res.error) setError(res.error)
      else setRows(res.reservations || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user) load() }, [user])

  const changeQty = async (item_id, delta) => {
    const token = session?.access_token
    const res = await reserveDelta({ token }, { item_id, delta })
    if (res.error) return setError(res.error)
    await load()
  }

  const cancelAll = async () => {
    const token = session?.access_token
    const res = await cancelAllReservations({ token })
    if (res.error) return setError(res.error)
    await load()
  }

  // Prefer server-provided unit_price/line_total when available for consistency
  const computeUnitPrice = (r) => {
    if (r?.unit_price != null) return Number(r.unit_price)
    const it = r?.item || {}
    const base = Number(it?.sell_price || 0)
    const dType = String(it?.discount_type || 'none')
    const dVal = Number(it?.discount_value || 0)
    if (dType === 'percent' && dVal > 0) return Number((base * (1 - dVal / 100)).toFixed(2))
    if (dType === 'fixed' && dVal > 0) return Number(Math.max(0, base - dVal).toFixed(2))
    return base
  }

  const total = rows.reduce((sum, r) => {
    const unit = computeUnitPrice(r)
    const qty = Number(r.quantity || 0)
    if (r?.line_total != null) return sum + Number(r.line_total || 0)
    return sum + unit * qty
  }, 0)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Your Reservations</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="bg-white rounded shadow p-4 flex gap-4 items-center">
              <img src={r.item?.image_url || '/vite.svg'} alt={r.item?.name} className="w-20 h-20 object-cover rounded" />
              <div className="flex-1">
                <div className="font-semibold">{r.item?.name}</div>
                <div className="text-sm">
                  {currency(computeUnitPrice(r))}
                  {((r.item && r.item.discount_type && r.item.discount_value != null && Number(r.item.discount_value) !== 0) || (r.discount_type && r.discount_value != null && Number(r.discount_value) !== 0)) ? (
                    <span className="ml-2 text-xs text-gray-500">(orig {currency(r.item?.sell_price||0)})</span>
                  ) : null}
                </div>
                {r.created_at && (
                  <div className="text-xs text-gray-600 mt-1">Reserved: {formatDateTime(r.created_at)}{r.expires_at ? ` • ${countdownTo(r.expires_at).text}` : ''}</div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => changeQty(r.item?.id, -1)}>−</button>
                  <span>{r.quantity}</span>
                  <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => changeQty(r.item?.id, 1)}>+</button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between font-semibold">
            <div>Total</div>
            <div>{currency(total)}</div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-200 rounded" onClick={cancelAll}>Cancel all</button>
          </div>
        </div>
      )}
    </div>
  )
}

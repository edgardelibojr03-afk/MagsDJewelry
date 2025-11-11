import React, { useState, useEffect } from 'react'
import { currency } from '../utils/format'

export default function ReserveModal({ open, item, onClose, onReserve, maxAvailable }) {
  const [qty, setQty] = useState(1)

  useEffect(() => { setQty(1) }, [item])

  if (!open || !item) return null

  const available = typeof maxAvailable === 'number' ? maxAvailable : ((item.total_quantity || 0) - (item.reserved_quantity || 0))
  const queued = available <= 0

  // compute discounted price if any
  const oldP = Number(item.sell_price || 0)
  let newP = oldP
  let savings = 0
  let suffix = ''
  if (item.discount_type && item.discount_value != null && Number(item.discount_value) !== 0) {
    if (String(item.discount_type) === 'percent') {
      const pct = Number(item.discount_value || 0)
      newP = Math.max(0, Math.round((oldP * (1 - pct / 100)) * 100) / 100)
      savings = oldP - newP
      suffix = `${pct}% off`
    } else if (String(item.discount_type) === 'fixed') {
      const amt = Number(item.discount_value || 0)
      newP = Math.max(0, Math.round((oldP - amt) * 100) / 100)
      savings = oldP - newP
      suffix = `${currency(savings)} off`
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
      <div className="bg-white rounded shadow-lg p-6 z-50 w-full max-w-2xl mx-4">
        <div className="flex gap-4">
          <img src={item.image_url || '/vite.svg'} alt={item.name} className="w-48 h-48 object-cover rounded" />
          <div className="flex-1">
            <h3 className="text-xl font-semibold">{item.name}</h3>
            <div className="text-sm text-gray-600 mb-2">{item.category_type || ''} {item.gold_type ? `• ${item.gold_type}` : ''} {item.karat ? `• ${item.karat}` : ''}</div>
            <div className="text-lg font-semibold mb-2">
              {item.discount_type && item.discount_value != null && Number(item.discount_value) !== 0 ? (
                <span>
                  <span className="text-gray-500 line-through mr-2">{currency(oldP)}</span>
                  <span className="font-semibold">{currency(newP)}</span>
                  <span className="ml-2 text-sm text-green-600">{suffix || ` - ${currency(savings)}`}</span>
                </span>
              ) : (
                <span>{currency(oldP)}</span>
              )}
            </div>
            <div className="text-sm text-gray-600 mb-4">{queued ? 'Currently fully reserved — you will be added to the queue.' : `Available: ${available}`}</div>

            <div className="flex items-center gap-2">
              <label className="text-sm">Quantity</label>
              <input type="number" min={1} className="w-24 border p-1 rounded text-center" value={qty} onChange={(e)=> setQty(Math.max(1, Number(e.target.value||1)))} />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
              <button onClick={() => onReserve(qty)} className="px-4 py-2 rounded bg-black text-white">{queued ? 'Queue Reserve' : 'Reserve'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

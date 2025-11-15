import { createClient } from '@supabase/supabase-js'

async function getUser(req, admin) {
  const auth = req.headers['authorization'] || req.headers['Authorization']
  const token = typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : ''
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return { ok: false, status: 401, error: 'Unauthorized' }
  return { ok: true, user: data.user }
}

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const authz = await getUser(req, admin)
  if (!authz.ok) return res.status(authz.status || 401).json({ error: authz.error })
  const user = authz.user

  // Cleanup: auto-cancel expired reservations for this user and restock reserved counts
  try {
    const { data: expired } = await admin
      .from('reservations')
      .select('id,item_id,quantity')
      .eq('user_id', user.id)
      .lt('expires_at', new Date().toISOString())
    if (expired && expired.length) {
      for (const r of expired) {
        // reduce reserved_quantity, not below 0
        const { data: itemRow } = await admin.from('items').select('reserved_quantity').eq('id', r.item_id).single()
        const newReserved = Math.max(0, Number(itemRow?.reserved_quantity || 0) - Number(r.quantity || 0))
        await admin.from('items').update({ reserved_quantity: newReserved }).eq('id', r.item_id)
      }
      const ids = expired.map((r) => r.id)
      await admin.from('reservations').delete().in('id', ids)
    }
  } catch {}

  const action = (req.method === 'GET' ? (req.query?.action || 'list') : (req.body?.action || '')).toLowerCase()

  try {
    if (action === 'list') {
      // Include discount fields so clients can show the correct reserved price
      const { data, error } = await admin
        .from('reservations')
        .select('id, quantity, created_at, expires_at, item:items(id, name, sell_price, image_url, discount_type, discount_value)')
        .eq('user_id', user.id)
      if (error) return res.status(500).json({ error: error.message })
      const reservations = (data || []).map((r) => {
        const base = Number(r?.item?.sell_price || 0)
        const dType = String(r?.item?.discount_type || 'none')
        const dVal = Number(r?.item?.discount_value || 0)
        let unit = base
        if (dType === 'percent' && dVal > 0) unit = Number((base * (1 - dVal / 100)).toFixed(2))
        else if (dType === 'fixed' && dVal > 0) unit = Number(Math.max(0, base - dVal).toFixed(2))
        const qty = Number(r.quantity || 0)
        return { ...r, unit_price: unit, line_total: Number((unit * qty).toFixed(2)) }
      })
      return res.status(200).json({ reservations })
    }

    if (action === 'reserve') {
      const { item_id, delta } = req.body || {}
      if (!item_id || !Number.isInteger(delta)) return res.status(400).json({ error: 'item_id and integer delta required' })
      const { data: item, error: itemErr } = await admin.from('items').select('*').eq('id', item_id).single()
      if (itemErr || !item) return res.status(404).json({ error: 'Item not found' })
      // Queue semantics: allow reservation even if currently fully reserved (no hard fail)
      const { data: existing } = await admin.from('reservations').select('*').eq('user_id', user.id).eq('item_id', item_id).maybeSingle()
      const newQty = Math.max(0, (existing?.quantity || 0) + delta)
      if (!existing && newQty === 0) return res.status(200).json({ ok: true, quantity: 0 })
      const expires_at = new Date(Date.now() + 30*24*60*60*1000).toISOString()

      // We'll capture the reservation row we create/update so we can revert if
      // adjusting the item's reserved_quantity fails (to avoid phantom reservations).
      let reservationRow = null
      try {
        if (!existing) {
          const { data: insData, error: insErr } = await admin.from('reservations').insert({ user_id: user.id, item_id, quantity: newQty, created_at: new Date().toISOString(), expires_at }).select('*').single()
          if (insErr) throw insErr
          reservationRow = insData
        } else if (newQty === 0) {
          // deleting reservation; capture id in case we need to restore
          reservationRow = existing
          const { error: delErr } = await admin.from('reservations').delete().eq('id', existing.id)
          if (delErr) throw delErr
        } else {
          const { data: updData, error: updErr } = await admin.from('reservations').update({ quantity: newQty, expires_at }).eq('id', existing.id).select('*').single()
          if (updErr) throw updErr
          reservationRow = updData
        }
      } catch (e) {
        return res.status(500).json({ error: e.message || 'Failed to modify reservation' })
      }

      const reservedDelta = newQty - (existing?.quantity || 0)
      if (reservedDelta !== 0) {
        // Try to adjust reserved count; if it fails, revert the reservation change
        const { error: itemUpdErr } = await admin.rpc('increment_reserved_quantity', { p_item_id: item_id, p_delta: reservedDelta })
        if (itemUpdErr) {
          // fallback direct update
          const newReserved = Math.max(0, Number(item.reserved_quantity || 0) + Number(reservedDelta))
          const { error: fallbackErr } = await admin.from('items').update({ reserved_quantity: newReserved }).eq('id', item_id)
          if (fallbackErr) {
            // Revert reservation change to previous state to avoid phantom reservations
            try {
              if (!existing) {
                // we created a new reservation row; delete it
                if (reservationRow && reservationRow.id) {
                  await admin.from('reservations').delete().eq('id', reservationRow.id)
                }
              } else {
                // we updated an existing reservation; restore previous quantity
                await admin.from('reservations').update({ quantity: existing.quantity, expires_at: existing.expires_at }).eq('id', existing.id)
              }
            } catch (revertErr) {
              // If revert fails, log and return server error; prefer to inform client
              return res.status(500).json({ error: 'Reservation failed and revert failed; please contact support' })
            }

            // Map constraint violation to friendly message when applicable
            const emsg = String(fallbackErr.message || '')
            if (emsg.includes('reserved_not_exceed_total') || emsg.includes('violates check constraint')) {
              return res.status(400).json({ error: 'Cannot reserve more than the available stock for this item.' })
            }
            return res.status(500).json({ error: fallbackErr.message })
          }
        }
      }
      return res.status(200).json({ ok: true, quantity: newQty })
    }

    if (action === 'cancel_all') {
      const { data: rows, error } = await admin.from('reservations').select('*').eq('user_id', user.id)
      if (error) return res.status(500).json({ error: error.message })
      for (const r of rows) {
        const { data: item } = await admin.from('items').select('reserved_quantity').eq('id', r.item_id).single()
        const newReserved = Math.max(0, (item?.reserved_quantity || 0) - (r.quantity || 0))
        await admin.from('items').update({ reserved_quantity: newReserved }).eq('id', r.item_id)
      }
      await admin.from('reservations').delete().eq('user_id', user.id)
      return res.status(200).json({ ok: true })
    }

    if (action === 'cancel') {
      // cancel a single reservation by reservation_id or item_id
      const reservation_id = req.query?.reservation_id || req.body?.reservation_id
      const item_id = req.query?.item_id || req.body?.item_id
      if (!reservation_id && !item_id) return res.status(400).json({ error: 'reservation_id or item_id required' })
      // find the reservation row
      let q = admin.from('reservations').select('*').eq('user_id', user.id)
      if (reservation_id) q = q.eq('id', reservation_id).maybeSingle()
      else q = q.eq('item_id', item_id).maybeSingle()
      const { data: row, error: rowErr } = await q
      if (rowErr) return res.status(500).json({ error: rowErr.message })
      if (!row) return res.status(404).json({ error: 'Reservation not found' })
      // adjust reserved_quantity on items
      try {
        const { data: item } = await admin.from('items').select('reserved_quantity').eq('id', row.item_id).single()
        const newReserved = Math.max(0, (item?.reserved_quantity || 0) - (row.quantity || 0))
        await admin.from('items').update({ reserved_quantity: newReserved }).eq('id', row.item_id)
      } catch (e) {
        return res.status(500).json({ error: 'Failed to update item reserved count' })
      }
      // delete reservation
      const { error: delErr } = await admin.from('reservations').delete().eq('id', row.id)
      if (delErr) return res.status(500).json({ error: delErr.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    // Map common DB check-constraint errors to friendly messages for clients
    const msg = String(err?.message || '')
    if (msg.includes('reserved_not_exceed_total') || msg.includes('violates check constraint')) {
      return res.status(400).json({ error: 'Cannot reserve more than the available stock for this item.' })
    }
    return res.status(500).json({ error: err.message })
  }
}

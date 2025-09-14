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

  const action = (req.method === 'GET' ? (req.query?.action || 'list') : (req.body?.action || '')).toLowerCase()

  try {
    if (action === 'list') {
      const { data, error } = await admin
        .from('reservations')
        .select('id, quantity, item:items(id, name, sell_price, image_url)')
        .eq('user_id', user.id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ reservations: data })
    }

    if (action === 'reserve') {
      const { item_id, delta } = req.body || {}
      if (!item_id || !Number.isInteger(delta)) return res.status(400).json({ error: 'item_id and integer delta required' })
      const { data: item, error: itemErr } = await admin.from('items').select('*').eq('id', item_id).single()
      if (itemErr || !item) return res.status(404).json({ error: 'Item not found' })
      const available = (item.total_quantity || 0) - (item.reserved_quantity || 0)
      if (delta > 0 && delta > available) return res.status(400).json({ error: 'Not enough stock to reserve' })
      const { data: existing } = await admin.from('reservations').select('*').eq('user_id', user.id).eq('item_id', item_id).maybeSingle()
      const newQty = Math.max(0, (existing?.quantity || 0) + delta)
      if (!existing && newQty === 0) return res.status(200).json({ ok: true, quantity: 0 })
      if (!existing) {
        const { error: insErr } = await admin.from('reservations').insert({ user_id: user.id, item_id, quantity: newQty })
        if (insErr) return res.status(500).json({ error: insErr.message })
      } else if (newQty === 0) {
        const { error: delErr } = await admin.from('reservations').delete().eq('id', existing.id)
        if (delErr) return res.status(500).json({ error: delErr.message })
      } else {
        const { error: updErr } = await admin.from('reservations').update({ quantity: newQty }).eq('id', existing.id)
        if (updErr) return res.status(500).json({ error: updErr.message })
      }
      const reservedDelta = newQty - (existing?.quantity || 0)
      if (reservedDelta !== 0) {
        const { error: itemUpdErr } = await admin.rpc('increment_reserved_quantity', { p_item_id: item_id, p_delta: reservedDelta })
        if (itemUpdErr) {
          const newReserved = Math.max(0, (item.reserved_quantity || 0) + reservedDelta)
          const { error: fallbackErr } = await admin.from('items').update({ reserved_quantity: newReserved }).eq('id', item_id)
          if (fallbackErr) return res.status(500).json({ error: fallbackErr.message })
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

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

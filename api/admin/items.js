import { createClient } from '@supabase/supabase-js'

async function authorize(req, admin) {
  const auth = req.headers['authorization'] || req.headers['Authorization']
  const token = typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : ''
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return { ok: false, status: 401, error: 'Unauthorized' }
  const u = data.user
  const roles = Array.isArray(u?.app_metadata?.roles) ? u.app_metadata.roles : []
  const isAdmin = Boolean(u?.app_metadata?.is_admin || u?.user_metadata?.is_admin || roles.includes('admin'))
  if (!isAdmin) return { ok: false, status: 403, error: 'Forbidden' }
  return { ok: true }
}

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const authz = await authorize(req, admin)
  if (!authz.ok) return res.status(authz.status || 401).json({ error: authz.error || 'Unauthorized' })

  const action = (req.method === 'GET' ? (req.query?.action || 'list') : (req.body?.action || '')).toLowerCase()

  try {
    if (action === 'list') {
      const { data, error } = await admin
        .from('items')
        .select('id,name,purchase_price,sell_price,total_quantity,reserved_quantity,image_url,created_at,status,discount_type,discount_value')
        .order('created_at', { ascending: false })
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ items: data })
    }
    if (action === 'create') {
      const { name, purchase_price, sell_price, total_quantity, image_url, status = 'active', discount_type = 'none', discount_value = 0 } = req.body || {}
      if (!name) return res.status(400).json({ error: 'Name is required' })
      if (Number(sell_price) < Number(purchase_price)) return res.status(400).json({ error: 'Sell price cannot be less than purchase price' })
      const allowedTypes = ['none','percent','fixed']
      if (!allowedTypes.includes(String(discount_type))) return res.status(400).json({ error: 'Invalid discount_type' })
      if (Number(discount_value) < 0) return res.status(400).json({ error: 'discount_value must be >= 0' })
      if (discount_type === 'percent' && Number(discount_value) > 100) return res.status(400).json({ error: 'percent discount cannot exceed 100' })
      const payload = {
        name,
        purchase_price: Number(purchase_price || 0),
        sell_price: Number(sell_price || 0),
        total_quantity: Number(total_quantity || 0),
        image_url: image_url || null,
        status,
        discount_type,
        discount_value: Number(discount_value || 0)
      }
      const { data, error } = await admin.from('items').insert(payload).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ item: data })
    }
    if (action === 'update') {
      const { id, name, purchase_price, sell_price, total_quantity, image_url, status, discount_type, discount_value } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id is required' })
      const patch = {}
      if (name !== undefined) patch.name = name
      if (purchase_price !== undefined) patch.purchase_price = Number(purchase_price)
      if (sell_price !== undefined) patch.sell_price = Number(sell_price)
      if (total_quantity !== undefined) patch.total_quantity = Number(total_quantity)
      if (image_url !== undefined) patch.image_url = image_url
      if (status !== undefined) patch.status = status
      if (discount_type !== undefined) patch.discount_type = discount_type
      if (discount_value !== undefined) patch.discount_value = Number(discount_value)
      if (patch.sell_price != null && (patch.purchase_price != null ? patch.purchase_price : undefined) != null) {
        if (Number(patch.sell_price) < Number(patch.purchase_price)) return res.status(400).json({ error: 'Sell price cannot be less than purchase price' })
      }
      const { data, error } = await admin.from('items').update(patch).eq('id', id).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ item: data })
    }
    if (action === 'restock') {
      const { id, quantity } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id is required' })
      const qty = Number(quantity || 0)
      if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'quantity must be > 0' })
      const { data: curr, error: readErr } = await admin.from('items').select('total_quantity').eq('id', id).single()
      if (readErr) return res.status(500).json({ error: readErr.message })
      const newQty = Number(curr?.total_quantity || 0) + qty
      const { data, error } = await admin.from('items').update({ total_quantity: newQty }).eq('id', id).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      // Optional: log restock if table exists
      try { await admin.from('restocks').insert({ item_id: id, quantity: qty }) } catch {}
      return res.status(200).json({ item: data })
    }
    if (action === 'delete') {
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id is required' })
      const { error } = await admin.from('items').delete().eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }
    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

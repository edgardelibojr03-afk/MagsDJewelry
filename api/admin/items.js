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
      const { category_type, gold_type, karat } = req.query || {}
      let query = admin
        .from('items')
        .select('*')
        .order('created_at', { ascending: false })
      if (category_type) query = query.eq('category_type', String(category_type))
      if (gold_type) query = query.eq('gold_type', String(gold_type))
      if (karat) query = query.eq('karat', String(karat))
      let { data, error } = await query
      if (error && typeof error.message === 'string' && /schema cache|could not find|column .* does not exist/i.test(error.message)) {
        // Fallback: return unfiltered list to avoid breaking UI while schema cache reload is pending
        const alt = await admin.from('items').select('*').order('created_at', { ascending: false })
        if (alt.error) return res.status(500).json({ error: alt.error.message })
        return res.status(200).json({ items: alt.data, warning: 'Schema cache not updated yet. Returned unfiltered items; please reload schema.' })
      }
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ items: data })
    }
    if (action === 'create') {
      const { name, purchase_price, sell_price, total_quantity, image_url, status = 'active', discount_type = 'none', discount_value = 0, category_type = null, gold_type = null, karat = null } = req.body || {}
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
        discount_value: Number(discount_value || 0),
        category_type,
        gold_type,
        karat
      }
      const { data, error } = await admin.from('items').insert(payload).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ item: data })
    }
    if (action === 'update') {
      const { id, name, purchase_price, sell_price, total_quantity, image_url, status, discount_type, discount_value, category_type, gold_type, karat } = req.body || {}
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
      // Only include category fields if provided as non-empty values to avoid schema cache errors
      if (category_type !== undefined && category_type !== null && category_type !== '') patch.category_type = category_type
      if (gold_type !== undefined && gold_type !== null && gold_type !== '') patch.gold_type = gold_type
      if (karat !== undefined && karat !== null && karat !== '') patch.karat = karat
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
      // Read current row including prices to avoid triggering constraint silently
      const { data: curr, error: readErr } = await admin
        .from('items')
        .select('total_quantity,purchase_price,sell_price')
        .eq('id', id)
        .single()
      if (readErr) return res.status(500).json({ error: readErr.message })
      if (Number(curr?.sell_price ?? 0) < Number(curr?.purchase_price ?? 0)) {
        return res.status(400).json({ error: 'Item price invalid: sell price is less than purchase price. Please fix the item pricing before restocking.' })
      }
      const newQty = Number(curr?.total_quantity || 0) + qty
      const { data, error } = await admin.from('items').update({ total_quantity: newQty }).eq('id', id).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      // Optional: log restock if table exists
      try { await admin.from('restocks').insert({ item_id: id, quantity: qty }) } catch {}
      return res.status(200).json({ item: data })
    }
    if (action === 'delete') {
      const { id, force } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id is required' })
      // If force flag is set, remove referencing reservations first
      if (force === true) {
        const { error: rErr } = await admin.from('reservations').delete().eq('item_id', id)
        if (rErr) return res.status(500).json({ error: rErr.message })
      }
      const { error } = await admin.from('items').delete().eq('id', id)
      if (error) {
        // Handle FK violation with a clearer message
        if (error.code === '23503') {
          return res.status(400).json({
            error: 'Cannot delete item: one or more reservations reference this item.',
            code: 'FK_VIOLATION',
            hint: 'Cancel user reservations for this item, archive it, or retry with force=true to delete reservations then the item.'
          })
        }
        return res.status(500).json({ error: error.message })
      }
      return res.status(200).json({ ok: true })
    }
    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

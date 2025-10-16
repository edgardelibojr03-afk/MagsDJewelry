import { createClient } from '@supabase/supabase-js'

async function authorize(req, admin) {
  const auth = req.headers['authorization'] || req.headers['Authorization']
  const token = typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : ''
  if (!token) return { ok: false, status: 401, error: 'Unauthorized - missing credentials' }
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return { ok: false, status: 401, error: 'Unauthorized - invalid token' }
  const u = data.user
  const roles = Array.isArray(u?.app_metadata?.roles) ? u.app_metadata.roles : []
  const isAdmin = Boolean(u?.app_metadata?.is_admin || u?.user_metadata?.is_admin || roles.includes('admin'))
  if (!isAdmin) return { ok: false, status: 403, error: 'Forbidden - admin only' }
  return { ok: true, user: u }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const authz = await authorize(req, admin)
  if (!authz.ok) return res.status(authz.status || 401).json({ error: authz.error || 'Unauthorized' })

  const { sale_id, items, reason, full } = req.body || {}
  // items: [{ sale_item_id, item_id, quantity }]
  if (!sale_id) return res.status(400).json({ error: 'sale_id required' })

  try {
    const { data: sale, error: saleErr } = await admin.from('sales').select('*').eq('id', sale_id).single()
    if (saleErr || !sale) return res.status(404).json({ error: 'Sale not found' })
    if (sale.status === 'voided') return res.status(400).json({ error: 'Sale already voided' })

    let refundItems = Array.isArray(items) ? items.filter(Boolean) : []
    if (full) {
      // Load all sale_items for full refund
      const { data: sItems, error: sItemsErr } = await admin.from('sale_items').select('id, item_id, quantity, price_at_purchase').eq('sale_id', sale_id)
      if (sItemsErr) return res.status(500).json({ error: sItemsErr.message })
      refundItems = (sItems || []).map(si => ({ sale_item_id: si.id, item_id: si.item_id, quantity: si.quantity }))
      if (refundItems.length === 0) return res.status(400).json({ error: 'No sale items to refund' })
    }
    if (!Array.isArray(refundItems) || refundItems.length === 0) {
      return res.status(400).json({ error: 'items[] required for partial refund' })
    }

    // Compute refund total and restock items
    let refundTotal = 0
    const insertedRefund = await admin.from('refunds').insert({ sale_id, user_id: sale.user_id, reason: reason || null, total: 0 }).select('*').single()
    if (insertedRefund.error) return res.status(500).json({ error: insertedRefund.error.message })
    const refund = insertedRefund.data

    for (const it of refundItems) {
      const { sale_item_id, item_id, quantity } = it || {}
      if (!sale_item_id || !item_id || !Number.isFinite(quantity) || quantity <= 0) continue
      const { data: sItem, error: sErr } = await admin.from('sale_items').select('*').eq('id', sale_item_id).single()
      if (sErr || !sItem) return res.status(400).json({ error: 'Invalid sale_item' })
      const price = Number(sItem.price_at_purchase || 0)
      refundTotal += price * Number(quantity)
      // insert refund line
      const ins = await admin.from('refund_items').insert({ refund_id: refund.id, sale_item_id, item_id, quantity, price_at_purchase: price })
      if (ins.error) return res.status(500).json({ error: ins.error.message })
      // restock items total_quantity by quantity
      const { data: itemRow } = await admin.from('items').select('total_quantity').eq('id', item_id).single()
      const newTotal = Number(itemRow?.total_quantity || 0) + Number(quantity)
      await admin.from('items').update({ total_quantity: newTotal }).eq('id', item_id)
    }

    await admin.from('refunds').update({ total: refundTotal }).eq('id', refund.id)

    // If full refund equals sale total, mark sale voided
    const { data: totals } = await admin.from('refunds').select('total').eq('sale_id', sale_id)
    const sumRefunds = (totals || []).reduce((a, r) => a + Number(r.total || 0), 0)
    const fullRefunded = Math.abs(sumRefunds - Number(sale.total || 0)) < 0.0001
    if (fullRefunded) {
      await admin.from('sales').update({ status: 'voided' }).eq('id', sale_id)
    }

    return res.status(200).json({ ok: true, refund_total: refundTotal, sale_id, refund_id: refund.id, fully_refunded: fullRefunded })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

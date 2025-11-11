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

  const { user_id, payment_method, layaway_months } = req.body || {}
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  try {
    const { data: rows, error } = await admin
      .from('reservations')
      .select('*, item:items(id, name, sell_price, total_quantity, reserved_quantity, discount_type, discount_value)')
      .eq('user_id', user_id)
    if (error) return res.status(500).json({ error: error.message })
    let total = 0
    // create sale header first (record admin)
    const { data: sale, error: saleErr } = await admin.from('sales').insert({ user_id, admin_user_id: authz.user.id }).select('*').single()
    if (saleErr) return res.status(500).json({ error: saleErr.message })
    const soldItemIds = new Set()
    for (const r of rows) {
      const q = Number(r.quantity || 0)
      const basePrice = Number(r.item?.sell_price || 0)
      // compute discounted price based on item's discount fields
      let unitPrice = basePrice
      const dType = String(r.item?.discount_type || 'none')
      const dVal = Number(r.item?.discount_value || 0)
      if (dType === 'percent' && dVal > 0) {
        unitPrice = Number((basePrice * (1 - dVal / 100)).toFixed(2))
      } else if (dType === 'fixed' && dVal > 0) {
        unitPrice = Number(Math.max(0, basePrice - dVal).toFixed(2))
      }
      total += q * unitPrice
      const newTotalQty = Math.max(0, (r.item?.total_quantity || 0) - q)
      const newReserved = Math.max(0, (r.item?.reserved_quantity || 0) - q)
      await admin.from('items').update({ total_quantity: newTotalQty, reserved_quantity: newReserved }).eq('id', r.item_id)
      // record line detail with price at purchase and discount metadata
      await admin.from('sale_items').insert({
        sale_id: sale.id,
        item_id: r.item_id,
        quantity: q,
        price_at_purchase: unitPrice,
        discount_type: dType || 'none',
        discount_value: dVal || 0
      })
      soldItemIds.add(r.item_id)
    }
    // Remove only the reservations that belonged to the user we just finalized.
    // Do NOT delete reservations belonging to other users — queued reservations
    // should remain untouched so other customers don't unexpectedly lose their
    // place in line. Previously we removed all reservations for sold items,
    // which caused other users' reservations to be deleted; that behavior is
    // unsafe and has been removed.
    await admin.from('reservations').delete().eq('user_id', user_id)
    // Handle payment/layaway details
    let patch = { total }
    const pm = (payment_method || 'full').toLowerCase()
    if (pm === 'layaway') {
      const months = Math.max(6, Number(layaway_months || 6))
      const down = Number((total * 0.05).toFixed(2))
      const receivable = Number((total - down).toFixed(2))
      const monthly = Number((receivable / months).toFixed(2))
      patch = { ...patch, payment_method: 'layaway', layaway_months: months, downpayment: down, amount_receivable: receivable, monthly_payment: monthly }
    } else {
      patch = { ...patch, payment_method: 'full', layaway_months: null, downpayment: 0, amount_receivable: 0, monthly_payment: 0 }
    }
    await admin.from('sales').update(patch).eq('id', sale.id)

    // TODO: Send simple email receipt via an email provider (e.g., Resend, SendGrid). Placeholder response for now.
  return res.status(200).json({ ok: true, total, sale_id: sale.id })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

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

  const { user_id } = req.body || {}
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  try {
    const { data: rows, error } = await admin
      .from('reservations')
      .select('*, item:items(id, name, sell_price, total_quantity, reserved_quantity)')
      .eq('user_id', user_id)
    if (error) return res.status(500).json({ error: error.message })
    let total = 0
    for (const r of rows) {
      const q = r.quantity || 0
      const price = r.item?.sell_price || 0
      total += q * price
      const newTotalQty = Math.max(0, (r.item?.total_quantity || 0) - q)
      const newReserved = Math.max(0, (r.item?.reserved_quantity || 0) - q)
      await admin.from('items').update({ total_quantity: newTotalQty, reserved_quantity: newReserved }).eq('id', r.item_id)
    }
    await admin.from('reservations').delete().eq('user_id', user_id)

    // TODO: Send simple email receipt via an email provider (e.g., Resend, SendGrid). Placeholder response for now.
    return res.status(200).json({ ok: true, total })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

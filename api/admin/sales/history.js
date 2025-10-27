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
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const authz = await authorize(req, admin)
  if (!authz.ok) return res.status(authz.status || 401).json({ error: authz.error || 'Unauthorized' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Optional filter by user_id
    const user_id = req.query?.user_id
    let q = admin.from('sales').select('*').order('created_at', { ascending: false }).limit(100)
    if (user_id) q = q.eq('user_id', user_id)
    const { data: sales, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    const ids = (sales || []).map((s) => s.id)
    let refundMap = {}
    if (ids.length) {
      const { data: refundRows } = await admin.from('refunds').select('sale_id,total').in('sale_id', ids)
      for (const r of refundRows || []) {
        refundMap[r.sale_id] = (refundMap[r.sale_id] || 0) + Number(r.total || 0)
      }
    }
    const enriched = (sales || []).map((s) => ({
      ...s,
      refunded_total: refundMap[s.id] || 0,
      net_total: Number(s.total || 0) - (refundMap[s.id] || 0)
    }))
    return res.status(200).json({ sales: enriched })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

import { createClient } from '@supabase/supabase-js'

async function authorize(req, admin) {
  const ADMIN_SECRET = process.env.ADMIN_SECRET
  const incomingRaw = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'] || (req.body && req.body.admin_secret)
  const incoming = typeof incomingRaw === 'string' ? incomingRaw.trim() : ''
  const serverSecret = (ADMIN_SECRET || '').trim()
  if (incoming && serverSecret && incoming === serverSecret) return { ok: true }

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
  return { ok: true, user: u }
}

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars (SUPABASE_URL or SUPABASE_SERVICE_ROLE) not configured' })
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const authz = await authorize(req, admin)
  if (!authz.ok) return res.status(authz.status || 401).json({ error: authz.error || 'Unauthorized' })

  const action = (req.method === 'GET' ? (req.query?.action || 'list') : (req.body?.action || '')).toLowerCase()

  try {
    if (action === 'list') {
      const result = await admin.auth.admin.listUsers()
      if (result.error) return res.status(500).json({ error: result.error.message })
      return res.status(200).json({ users: result.data })
    }

    if (action === 'reservations') {
      const { user_id } = (req.method === 'GET' ? req.query : req.body) || {}
      if (!user_id) return res.status(400).json({ error: 'user_id is required' })
      // Cleanup expired reservations for this user
      try {
        const { data: expired } = await admin
          .from('reservations')
          .select('id,item_id,quantity')
          .eq('user_id', user_id)
          .lt('expires_at', new Date().toISOString())
        if (expired && expired.length) {
          for (const r of expired) {
            const { data: itemRow } = await admin.from('items').select('reserved_quantity').eq('id', r.item_id).single()
            const newReserved = Math.max(0, Number(itemRow?.reserved_quantity || 0) - Number(r.quantity || 0))
            await admin.from('items').update({ reserved_quantity: newReserved }).eq('id', r.item_id)
          }
          const ids = expired.map((r) => r.id)
          await admin.from('reservations').delete().in('id', ids)
        }
      } catch {}
      const { data, error } = await admin
        .from('reservations')
        .select(`
          id,
          item_id,
          quantity,
          created_at,
          expires_at,
          items:items(id, name, sell_price, image_url, available_quantity, discount_type, discount_value)
        `)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
      if (error) return res.status(500).json({ error: error.message })
      const reservations = data || []
      // Compute total using discounted unit price when applicable
      const mapped = reservations.map((r) => {
        const base = Number(r?.items?.sell_price || 0)
        const dType = String(r?.items?.discount_type || 'none')
        const dVal = Number(r?.items?.discount_value || 0)
        let unit = base
        if (dType === 'percent' && dVal > 0) unit = Number((base * (1 - dVal / 100)).toFixed(2))
        else if (dType === 'fixed' && dVal > 0) unit = Number(Math.max(0, base - dVal).toFixed(2))
        const qty = Number(r.quantity || 0)
        return { ...r, unit_price: unit, line_total: Number((unit * qty).toFixed(2)) }
      })
      const total = mapped.reduce((sum, r) => sum + Number(r.line_total || 0), 0)
      return res.status(200).json({ reservations: mapped, total })
    }

    if (action === 'create') {
      const { email, password, name, is_admin } = req.body || {}
      if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
      const app_metadata = {}
      if (typeof is_admin === 'boolean') {
        app_metadata.is_admin = is_admin
        if (is_admin) app_metadata.roles = ['admin']
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        user_metadata: name ? { full_name: name } : undefined,
        app_metadata: Object.keys(app_metadata).length ? app_metadata : undefined,
        email_confirm: true
      })
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ user: data.user })
    }

    if (action === 'update') {
      const { id, email, password, name, is_admin, blocked } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id is required' })
      const patch = {}
      if (email !== undefined) patch.email = email
      if (password !== undefined) patch.password = password
      if (name !== undefined) patch.user_metadata = { full_name: name }
      if (is_admin !== undefined) {
        patch.app_metadata = {
          is_admin: !!is_admin,
          roles: is_admin ? ['admin'] : []
        }
      }
      if (blocked !== undefined) {
        patch.app_metadata = {
          ...(patch.app_metadata || {}),
          blocked: !!blocked
        }
      }
      const { data, error } = await admin.auth.admin.updateUserById(id, patch)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ user: data.user })
    }

    if (action === 'delete') {
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id is required' })
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

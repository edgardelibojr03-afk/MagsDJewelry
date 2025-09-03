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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  // ADMIN_SECRET is optional if Bearer token is provided

  const { id, email, password, name, is_admin, blocked } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id is required' })

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars (SUPABASE_URL or SUPABASE_SERVICE_ROLE) not configured' })
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const authz = await authorize(req, admin)
  if (!authz.ok) return res.status(authz.status || 401).json({ error: authz.error || 'Unauthorized' })

  try {
    let app_metadata_update
    if (typeof is_admin === 'boolean' || typeof blocked === 'boolean') {
      const { data: existing, error: getErr } = await admin.auth.admin.getUserById(id)
      if (getErr) return res.status(500).json({ error: getErr.message })
      const current = existing?.user?.app_metadata || {}

      const next = { ...current }
      if (typeof is_admin === 'boolean') {
        next.is_admin = is_admin
        let roles = Array.isArray(next.roles) ? next.roles.filter(Boolean) : []
        if (is_admin) {
          if (!roles.includes('admin')) roles.push('admin')
        } else {
          roles = roles.filter((r) => r !== 'admin')
        }
        next.roles = roles
      }
      if (typeof blocked === 'boolean') {
        next.blocked = blocked
      }
      app_metadata_update = next
    }

    const { data, error } = await admin.auth.admin.updateUserById(id, {
      email,
      password,
      user_metadata: name ? { full_name: name } : undefined,
      app_metadata: app_metadata_update
    })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ user: data.user })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

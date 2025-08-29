import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const ADMIN_SECRET = process.env.ADMIN_SECRET
  if (!ADMIN_SECRET) return res.status(500).json({ error: 'ADMIN_SECRET not configured' })
  const incomingRaw = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'] || (req.body && req.body.admin_secret)
  const incoming = typeof incomingRaw === 'string' ? incomingRaw.trim() : ''
  const serverSecret = (ADMIN_SECRET || '').trim()
  if (incoming !== serverSecret) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id is required' })

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars (SUPABASE_URL or SUPABASE_SERVICE_ROLE) not configured' })
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

  try {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

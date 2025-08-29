import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Protect this endpoint with a server-only secret set in Vercel (ADMIN_SECRET)
  const ADMIN_SECRET = process.env.ADMIN_SECRET
  if (!ADMIN_SECRET) return res.status(500).json({ error: 'ADMIN_SECRET not configured on server' })

  // Accept secret from header or query, and be lenient with surrounding spaces
  const incomingRaw = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'] || req.query.admin_secret
  const incoming = typeof incomingRaw === 'string' ? incomingRaw.trim() : ''
  const serverSecret = (ADMIN_SECRET || '').trim()
  if (!incoming || incoming !== serverSecret) {
    return res.status(401).json({ error: 'Unauthorized - missing or invalid admin secret' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars (SUPABASE_URL or SUPABASE_SERVICE_ROLE) not configured' })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

  try {
    // Uses the Admin API - requires service_role key
    // supabase-js v2 provides auth.admin.listUsers()
    const result = await admin.auth.admin.listUsers()
    if (result.error) return res.status(500).json({ error: result.error.message })
    return res.status(200).json({ users: result.data })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

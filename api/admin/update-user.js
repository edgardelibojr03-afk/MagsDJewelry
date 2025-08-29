import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const ADMIN_SECRET = process.env.ADMIN_SECRET
  if (!ADMIN_SECRET) return res.status(500).json({ error: 'ADMIN_SECRET not configured' })
  const incoming = req.headers['x-admin-secret']
  if (incoming !== ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' })

  const { id, email, password, name } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id is required' })

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

  try {
    const { data, error } = await admin.auth.admin.updateUserById(id, {
      email,
      password,
      user_metadata: name ? { full_name: name } : undefined,
    })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ user: data.user })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

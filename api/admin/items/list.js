import { createClient } from '@supabase/supabase-js'

async function authorize(req, admin) {
  const ADMIN_SECRET = process.env.ADMIN_SECRET
  const incomingRaw = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'] || req.query?.admin_secret
  const incoming = typeof incomingRaw === 'string' ? incomingRaw.trim() : ''
  const serverSecret = (ADMIN_SECRET || '').trim()
  if (incoming && serverSecret && incoming === serverSecret) return { ok: true }

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

  try {
    const { data, error } = await admin.from('items').select('*').order('created_at', { ascending: false })
    if (error) {
      if (error.message?.toLowerCase()?.includes('relation') && error.message?.toLowerCase()?.includes('does not exist')) {
        return res.status(400).json({
          error: 'Missing tables',
          hint: 'Run the provided SQL to create tables (items, reservations) in Supabase',
          sql: `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purchase_price numeric(10,2) NOT NULL DEFAULT 0,
  sell_price numeric(10,2) NOT NULL DEFAULT 0,
  total_quantity integer NOT NULL DEFAULT 0,
  reserved_quantity integer NOT NULL DEFAULT 0,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);
          `.trim()
        })
      }
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ items: data })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

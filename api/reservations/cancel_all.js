import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const auth = req.headers['authorization'] || req.headers['Authorization']
  const token = typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : ''
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: authData, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !authData?.user) return res.status(401).json({ error: 'Unauthorized' })
  const user = authData.user
  try {
    // Return all reserved quantities back to items
    const { data: rows, error } = await admin.from('reservations').select('*').eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    for (const r of rows) {
      const { data: item } = await admin.from('items').select('reserved_quantity').eq('id', r.item_id).single()
      const newReserved = Math.max(0, (item?.reserved_quantity || 0) - (r.quantity || 0))
      await admin.from('items').update({ reserved_quantity: newReserved }).eq('id', r.item_id)
    }
    await admin.from('reservations').delete().eq('user_id', user.id)
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

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

function peso(n) {
  const v = Number(n || 0)
  return `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const authz = await authorize(req, admin)
  if (!authz.ok) return res.status(authz.status || 401).json({ error: authz.error || 'Unauthorized' })

  const sale_id = req.query?.sale_id
  if (!sale_id) return res.status(400).json({ error: 'sale_id is required' })

  try {
    const { data: sale, error: sErr } = await admin.from('sales').select('*').eq('id', sale_id).single()
    if (sErr || !sale) return res.status(404).json({ error: 'Sale not found' })
    const { data: lines, error: lErr } = await admin
      .from('sale_items')
      .select('quantity, price_at_purchase, item:items(name)')
      .eq('sale_id', sale_id)
    if (lErr) return res.status(500).json({ error: lErr.message })

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4 portrait
    const { width, height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    let y = height - 50
    const drawText = (text, x, yy, opts = {}) => {
      page.drawText(String(text ?? ''), { x, y: yy, size: opts.size || 12, font: opts.bold ? fontBold : font, color: opts.color || rgb(0,0,0) })
    }

    // Header
    drawText('Invoice', 50, y, { size: 24, bold: true })
    y -= 30
    drawText(`Sale ID: ${sale.id}`, 50, y)
    y -= 18
    drawText(`Date: ${new Date(sale.created_at || Date.now()).toLocaleString()}`, 50, y)
    y -= 6
    drawText(`User ID: ${sale.user_id}`, 50, y)
    y -= 24

    // Table headers
    drawText('Item', 50, y, { bold: true })
    drawText('Qty', 300, y, { bold: true })
    drawText('Unit Price', 360, y, { bold: true })
    drawText('Line Total', 460, y, { bold: true })
    y -= 12
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8,0.8,0.8) })
    y -= 10

    let total = 0
    for (const li of lines || []) {
      const name = li.item?.name || 'Item'
      const qty = Number(li.quantity || 0)
      const unit = Number(li.price_at_purchase || 0)
      const lineTotal = qty * unit
      total += lineTotal
      if (y < 80) {
        // new page
        y = height - 60
      }
      drawText(name, 50, y)
      drawText(qty, 300, y)
      drawText(peso(unit), 360, y)
      drawText(peso(lineTotal), 460, y)
      y -= 18
    }

    y -= 10
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8,0.8,0.8) })
    y -= 18
    drawText(`Total: ${peso(total)}`, 460, y, { bold: true })

    const pdfBytes = await pdfDoc.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${sale.id}.pdf"`)
    return res.status(200).send(Buffer.from(pdfBytes))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

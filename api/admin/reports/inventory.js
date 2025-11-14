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

function php(n) {
  const v = Number(n || 0)
  return `PHP ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  const SHOP_NAME = process.env.SHOP_NAME || 'MagsD Jewelry'
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const authz = await authorize(req, admin)
  if (!authz.ok) return res.status(authz.status || 401).json({ error: authz.error || 'Unauthorized' })

  try {
    const { data: items, error } = await admin
      .from('items')
      .select('id, name, sell_price, total_quantity, reserved_quantity, available_quantity')
      .order('name', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })

    // Debug JSON output
    if (String(req.query?.debug || '') === '1') {
      return res.status(200).json({ items })
    }

    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([842, 595]) // landscape A4
    let { width, height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const margin = 40
    let y = height - margin

    const drawText = (text, x, yy, opts = {}) => {
      page.drawText(String(text ?? ''), { x, y: yy, size: opts.size || 10, font: opts.bold ? fontBold : font, color: opts.color || rgb(0,0,0) })
    }

    // Header
    drawText(SHOP_NAME, margin, y, { size: 16, bold: true })
    drawText('Inventory Report', margin + 300, y, { size: 16, bold: true })
    y -= 22
    const tz = process.env.TIMEZONE || 'Asia/Manila'
    drawText(`Generated: ${new Date().toLocaleString('en-PH', { timeZone: tz })} ${tz}`, margin, y)
    y -= 18

    // Table header
    const colName = margin
    const colTotal = 360
    const colReserved = 430
    const colAvail = 500
    const colUnit = 570
    const colValue = 660
    drawText('Item', colName, y, { bold: true })
    drawText('Total', colTotal, y, { bold: true })
    drawText('Reserved', colReserved, y, { bold: true })
    drawText('Available', colAvail, y, { bold: true })
    drawText('Unit Price', colUnit, y, { bold: true })
    drawText('Total Value', colValue, y, { bold: true })
    y -= 12
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8,0.8,0.8) })
    y -= 10

    let grandTotal = 0
    for (const it of items || []) {
      const name = it.name || 'Item'
      const totalQty = Number(it.total_quantity || 0)
      const reserved = Number(it.reserved_quantity || 0)
      const avail = typeof it.available_quantity !== 'undefined' ? Number(it.available_quantity || Math.max(totalQty - reserved, 0)) : Math.max(totalQty - reserved, 0)
      const unit = Number(it.sell_price || 0)
      const value = Number((unit * totalQty).toFixed(2))
      grandTotal += value

      if (y < 60) {
        page = pdfDoc.addPage([842, 595])
        const sz = page.getSize(); width = sz.width; height = sz.height; y = height - margin
      }

      drawText(name, colName, y)
      drawText(String(totalQty), colTotal, y)
      drawText(String(reserved), colReserved, y)
      drawText(String(avail), colAvail, y)
      drawText(php(unit), colUnit, y)
      drawText(php(value), colValue, y)
      y -= 14
    }

    y -= 10
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8,0.8,0.8) })
    y -= 18
    drawText('Grand inventory value:', colUnit, y, { bold: true })
    drawText(php(grandTotal), colValue, y, { bold: true })

    const pdfBytes = await pdfDoc.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="inventory_report.pdf"`)
    return res.status(200).send(Buffer.from(pdfBytes))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

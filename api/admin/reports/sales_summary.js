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

function periodLabel(dt, period) {
  const d = new Date(dt)
  if (period === 'daily') return d.toISOString().slice(0,10)
  if (period === 'weekly') {
    // week starting monday
    const day = (d.getDay() + 6) % 7 // 0=Mon..6=Sun
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toISOString().slice(0,10)
  }
  if (period === 'monthly') return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  if (period === 'quarterly') {
    const q = Math.floor(d.getMonth()/3) + 1
    return `${d.getFullYear()}-Q${q}`
  }
  return d.toISOString().slice(0,10)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return res.status(500).json({ error: 'Supabase env vars not configured' })
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const authz = await authorize(req, admin)
  if (!authz.ok) return res.status(authz.status || 401).json({ error: authz.error || 'Unauthorized' })

  try {
    const period = String(req.query?.period || 'daily').toLowerCase()
    const start = req.query?.start ? new Date(req.query.start) : new Date(Date.now() - 30*24*60*60*1000)
    const end = req.query?.end ? new Date(req.query.end) : new Date()

    // Load sales in range
    const { data: sales, error: sErr } = await admin.from('sales').select('id, created_at').gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
    if (sErr) return res.status(500).json({ error: sErr.message })
    const saleIds = (sales || []).map((s) => s.id)

    if (!saleIds.length) return res.status(200).json({ summary: [], total_gross:0, total_net:0 })

    // Fetch sale_items for these sales and include item purchase_price
    const { data: items, error: itErr } = await admin.from('sale_items').select('sale_id, item_id, quantity, price_at_purchase, item:items(purchase_price)').in('sale_id', saleIds)
    if (itErr) return res.status(500).json({ error: itErr.message })

    // Map sale id to created_at
    const saleMap = {}
    for (const s of sales) saleMap[s.id] = s.created_at

    // Aggregate
    const buckets = {}
    let totalGross = 0
    let totalNet = 0
    for (const it of items || []) {
      const qty = Number(it.quantity || 0)
      const netPrice = Number(it.price_at_purchase || 0)
      const grossPrice = Number(it.item?.purchase_price || 0)
      const saleCreated = saleMap[it.sale_id]
      const label = periodLabel(saleCreated, period)
      buckets[label] = buckets[label] || { gross: 0, net: 0 }
      buckets[label].gross += grossPrice * qty
      buckets[label].net += netPrice * qty
      totalGross += grossPrice * qty
      totalNet += netPrice * qty
    }

    // Convert to array sorted by label (lexicographic ok for daily/monthly keys)
    const summary = Object.keys(buckets).sort().map((k) => ({ period: k, gross: Number(buckets[k].gross.toFixed(2)), net: Number(buckets[k].net.toFixed(2)) }))

    // If PDF requested, render similar to inventory report layout
    const fmt = String(req.query?.format || '').toLowerCase()
    if (fmt === 'pdf') {
      const SHOP_NAME = process.env.SHOP_NAME || 'MagsD Jewelry'
      const tz = process.env.TIMEZONE || 'Asia/Manila'
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

      const php = (n) => `PHP ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

      // Header
      drawText(SHOP_NAME, margin, y, { size: 16, bold: true })
      drawText('Sales Summary', margin + 300, y, { size: 16, bold: true })
      y -= 22
      drawText(`Generated: ${new Date().toLocaleString('en-PH', { timeZone: tz })} ${tz}`, margin, y)
      y -= 18

      // Table header
      const colPeriod = margin
      const colGross = 300
      const colNet = 460
      drawText('Period', colPeriod, y, { bold: true })
      drawText('Gross', colGross, y, { bold: true })
      drawText('Net', colNet, y, { bold: true })
      y -= 12
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8,0.8,0.8) })
      y -= 10

      let grandGross = 0
      let grandNet = 0
      for (const row of summary) {
        if (y < 60) {
          page = pdfDoc.addPage([842, 595])
          const sz = page.getSize(); width = sz.width; height = sz.height; y = height - margin
        }
        drawText(row.period, colPeriod, y)
        drawText(php(row.gross), colGross, y)
        drawText(php(row.net), colNet, y)
        grandGross += Number(row.gross || 0)
        grandNet += Number(row.net || 0)
        y -= 14
      }

      y -= 10
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8,0.8,0.8) })
      y -= 18
      drawText('Total Gross:', colGross, y, { bold: true })
      drawText(php(grandGross), colNet, y, { bold: true })
      y -= 16
      drawText('Total Net:', colGross, y, { bold: true })
      drawText(php(grandNet), colNet, y, { bold: true })

      const pdfBytes = await pdfDoc.save()
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="sales_summary.pdf"`)
      return res.status(200).send(Buffer.from(pdfBytes))
    }

    return res.status(200).json({ summary, total_gross: Number(totalGross.toFixed(2)), total_net: Number(totalNet.toFixed(2)) })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

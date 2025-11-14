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
  const SHOP_LOGO_URL = process.env.SHOP_LOGO_URL || ''
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return res.status(500).json({ error: 'Supabase env vars not configured' })
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const authz = await authorize(req, admin)
  if (!authz.ok) return res.status(authz.status || 401).json({ error: authz.error || 'Unauthorized' })

  const refund_id = req.query?.refund_id
  if (!refund_id) return res.status(400).json({ error: 'refund_id is required' })

  try {
    const { data: refund, error: rErr } = await admin.from('refunds').select('*').eq('id', refund_id).single()
    if (rErr || !refund) return res.status(404).json({ error: 'Refund not found' })
    const { data: items, error: itErr } = await admin
      .from('refund_items')
      .select('quantity, price_at_purchase, sale_item:sale_items(price_at_purchase,quantity), item:items(name, sell_price)')
      .eq('refund_id', refund_id)
    if (itErr) return res.status(500).json({ error: itErr.message })

    // Fetch related sale (avoid chaining .catch on the PostgREST builder — use returned error)
    let sale = null
    try {
      const { data: _sale, error: saleErr } = await admin.from('sales').select('*').eq('id', refund.sale_id).single()
      if (!saleErr) sale = _sale
    } catch (e) {
      // in case of unexpected runtime error keep sale=null
      sale = null
    }

    // Customer info
    let customerEmail = ''
    let customerName = ''
    try {
      const { data: ures } = await admin.auth.admin.getUserById(refund.user_id)
      const usr = ures?.user
      customerEmail = usr?.email || ''
      customerName = usr?.user_metadata?.full_name || usr?.user_metadata?.name || ''
    } catch {}

    // If debug=1 return JSON
    if (String(req.query?.debug || '') === '1') {
      return res.status(200).json({ refund, items, sale })
    }

    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([595, 842])
    let { width, height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const margin = 50
    let y = height - margin

    const drawText = (text, x, yy, opts = {}) => {
      page.drawText(String(text ?? ''), { x, y: yy, size: opts.size || 12, font: opts.bold ? fontBold : font, color: opts.color || rgb(0,0,0) })
    }
    const newPage = () => {
      page = pdfDoc.addPage([595, 842])
      const sz = page.getSize()
      width = sz.width
      height = sz.height
      y = height - margin
    }

    // Header
    if (SHOP_LOGO_URL) {
      try {
        const resp = await fetch(SHOP_LOGO_URL)
        const arr = new Uint8Array(await resp.arrayBuffer())
        let img
        if (SHOP_LOGO_URL.toLowerCase().endsWith('.png')) img = await pdfDoc.embedPng(arr)
        else img = await pdfDoc.embedJpg(arr)
        const iw = 80
        const ih = (img.height / img.width) * iw
        page.drawImage(img, { x: margin, y: y - ih, width: iw, height: ih })
        drawText(SHOP_NAME, margin + iw + 10, y - 10, { size: 18, bold: true })
        y -= Math.max(ih, 30) + 10
      } catch {
        drawText(SHOP_NAME, margin, y, { size: 18, bold: true })
        y -= 24
      }
    } else {
      drawText(SHOP_NAME, margin, y, { size: 18, bold: true })
      y -= 24
    }

    drawText('Refund Receipt', margin, y, { size: 16, bold: true })
    y -= 20
    drawText(`Refund ID: ${refund.id}`, margin, y)
    y -= 16
    if (sale?.id) {
      drawText(`Sale ID: ${sale.id}`, margin, y)
      y -= 16
    }
    const tz = process.env.TIMEZONE || 'Asia/Manila'
    const dt = new Date(refund.created_at || Date.now())
    const dateStr = dt.toLocaleString('en-PH', { timeZone: tz, year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    drawText(`Date: ${dateStr} ${tz}`, margin, y)
    y -= 16
    const cust = customerName || customerEmail || refund.user_id
    drawText(`Customer: ${cust}`, margin, y)
    y -= 20

    // Table headers
    const colItem = margin
    const colQty = 300
    const colUnit = 360
    const colLine = 460
    drawText('Item', colItem, y, { bold: true })
    drawText('Qty', colQty, y, { bold: true })
    drawText('Unit Price', colUnit, y, { bold: true })
    drawText('Line Total', colLine, y, { bold: true })
    y -= 12
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8,0.8,0.8) })
    y -= 8

    let total = 0
    for (const it of items || []) {
      const name = it.item?.name || 'Item'
      const qty = Number(it.quantity || 0)
      const unit = Number(it.price_at_purchase || (it.sale_item?.price_at_purchase || 0))
      const lineTotal = qty * unit
      total += lineTotal
      if (y < 90) {
        newPage()
        drawText('Item', colItem, y, { bold: true })
        drawText('Qty', colQty, y, { bold: true })
        drawText('Unit Price', colUnit, y, { bold: true })
        drawText('Line Total', colLine, y, { bold: true })
        y -= 12
        page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8,0.8,0.8) })
        y -= 8
      }
      drawText(name, colItem, y)
      drawText(qty, colQty, y)
      drawText(php(unit), colUnit, y)
      drawText(php(lineTotal), colLine, y)
      y -= 14
    }

    y -= 8
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8,0.8,0.8) })
    y -= 16
    drawText(`Refund Total: ${php(total)}`, colLine, y, { bold: true })

    const pdfBytes = await pdfDoc.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="refund_${refund.id}.pdf"`)
    return res.status(200).send(Buffer.from(pdfBytes))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

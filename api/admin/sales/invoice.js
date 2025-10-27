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

    // Fetch customer info and admin (finalized by)
    let customerEmail = ''
    let customerName = ''
    let adminEmail = ''
    try {
      if (sale.admin_user_id) {
        const { data: adminUserRes } = await admin.auth.admin.getUserById(sale.admin_user_id)
        adminEmail = adminUserRes?.user?.email || ''
      }
    } catch {}
    try {
      const { data: ures } = await admin.auth.admin.getUserById(sale.user_id)
      const usr = ures?.user
      customerEmail = usr?.email || ''
      customerName = usr?.user_metadata?.full_name || usr?.user_metadata?.name || ''
    } catch {}

    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([595, 842]) // A4 portrait
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
    // Optional logo
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
    drawText('Invoice', margin, y, { size: 16, bold: true })
    y -= 20
    drawText(`Sale ID: ${sale.id}`, margin, y)
    y -= 16
    drawText(`Date: ${new Date(sale.created_at || Date.now()).toLocaleString()}`, margin, y)
    y -= 16
    const cust = customerName || customerEmail || sale.user_id
    drawText(`Customer: ${cust}`, margin, y)
    y -= 24
    if (adminEmail) {
      drawText(`Finalized by: ${adminEmail}`, margin, y)
      y -= 16
    }
    if (sale.payment_method === 'layaway') {
      drawText(`Payment: Layaway`, margin, y)
      y -= 16
      drawText(`Downpayment (5%): ${php(sale.downpayment || 0)}`, margin, y)
      y -= 16
      drawText(`Amount receivable: ${php(sale.amount_receivable || 0)}`, margin, y)
      y -= 16
      drawText(`Months: ${sale.layaway_months} • Monthly: ${php(sale.monthly_payment || 0)}`, margin, y)
      y -= 16
    }

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
    for (const li of lines || []) {
      const name = li.item?.name || 'Item'
      const qty = Number(li.quantity || 0)
      const unit = Number(li.price_at_purchase || 0)
      const lineTotal = qty * unit
      total += lineTotal
      if (y < 90) {
        newPage()
        // reprint table header on new page
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
      y -= 18
    }

    y -= 8
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8,0.8,0.8) })
    y -= 16
    drawText(`Total: ${php(total)}`, colLine, y, { bold: true })

    const pdfBytes = await pdfDoc.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${sale.id}.pdf"`)
    return res.status(200).send(Buffer.from(pdfBytes))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

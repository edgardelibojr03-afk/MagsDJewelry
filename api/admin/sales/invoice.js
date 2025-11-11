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
      .select('quantity, price_at_purchase, discount_type, discount_value, item:items(name, sell_price)')
      .eq('sale_id', sale_id)
    if (lErr) return res.status(500).json({ error: lErr.message })

    // Debugging helper: if caller requests debug=1, return JSON of sale + lines
    if (String(req.query?.debug || '') === '1') {
      return res.status(200).json({ sale, lines })
    }

    // Temporary debug: log sale + lines so we can confirm what the PDF
    // generator is seeing when the user reports "invoice shows full"
    try {
      console.log('admin/sales/invoice - generating PDF for sale:', sale?.id)
      console.log('admin/sales/invoice - sale row:', sale)
      console.log('admin/sales/invoice - sale lines:', lines)
    } catch (e) {}

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
  // Format date using configured timezone (default to Asia/Manila) so printed
  // invoice times match business local time instead of server/UTC time.
  const tz = process.env.TIMEZONE || 'Asia/Manila'
  const dt = new Date(sale.created_at || Date.now())
  const dateStr = dt.toLocaleString('en-PH', { timeZone: tz, year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  drawText(`Date: ${dateStr} ${tz}`, margin, y)
    y -= 16
    const cust = customerName || customerEmail || sale.user_id
    drawText(`Customer: ${cust}`, margin, y)
    y -= 24
    if (adminEmail) {
      drawText(`Finalized by: ${adminEmail}`, margin, y)
      y -= 16
    }
    // Capture payment/layaway fields for later rendering near the bottom
    // (we'll render the layaway summary after the item list so it appears
    // at the bottom of the invoice). Keep per-line layaway info under each
    // item as before.
    const pm = String(sale.payment_method || '').toLowerCase()
    const down = Number(sale.downpayment || 0)
    const receivable = Number(sale.amount_receivable || 0)
    const months = Number(sale.layaway_months || 0)
    const monthly = Number(sale.monthly_payment || 0)

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
  const orig = Number(li.item?.sell_price || unit)
  const dType = String(li.discount_type || 'none')
  const dVal = Number(li.discount_value || 0)
      const lineTotal = qty * unit
      // If this sale is a layaway, compute per-line layaway breakdown so
      // invoice can show per-item downpayment and monthly amounts.
      const isLay = (String(sale.payment_method || '').toLowerCase() === 'layaway')
      const monthsForLay = Number(sale.layaway_months || 0)
      const lineDown = isLay ? Number((lineTotal * 0.05).toFixed(2)) : 0
      const lineReceivable = isLay ? Number((lineTotal - lineDown).toFixed(2)) : 0
      const lineMonthly = (isLay && monthsForLay > 0) ? Number((lineReceivable / monthsForLay).toFixed(2)) : 0
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
      // Show item name and, if discounted, show original price & discount info
      drawText(name, colItem, y)
      if (dType !== 'none' && dVal > 0) {
        const info = `(orig: ${php(orig)}, ${dType}: ${dVal}${dType==='percent'?'%':''})`
        drawText(info, colItem + 2, y - 12, { size: 10 })
      }
      drawText(qty, colQty, y)
      drawText(php(unit), colUnit, y)
      drawText(php(lineTotal), colLine, y)
      // Leave a slightly larger gap before drawing per-line layaway info
      // so it doesn't overlap the discount/info text printed under the
      // item name.
      if (isLay) {
        // a slightly larger gap so layaway info sits below the discount text
        y -= 22
        const layInfo = `Down: ${php(lineDown)} • ${monthsForLay} months • Monthly: ${php(lineMonthly)}`
        drawText(layInfo, colItem, y, { size: 10 })
        y -= 14
      } else {
        y -= 10
      }
    }

    y -= 8

    // Render layaway summary at the bottom of the items list so it is
    // visually grouped with totals. Leave a small gap before drawing.
    if (pm === 'layaway' || months > 0 || down > 0 || receivable > 0 || monthly > 0) {
      // Ensure spacing
      y -= 8
      drawText(`Payment: ${pm === 'layaway' ? 'Layaway' : (sale.payment_method || 'Custom')}`, margin, y)
      y -= 16
      drawText(`Downpayment (5%): ${php(down)}`, margin, y)
      y -= 16
      drawText(`Amount receivable: ${php(receivable)}`, margin, y)
      y -= 16
      drawText(`Months: ${months || '-'} • Monthly: ${php(monthly)}`, margin, y)
      y -= 16
    }

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

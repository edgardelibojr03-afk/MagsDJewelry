export function currency(n) {
  const num = Number(n || 0)
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(num)
  } catch {
    // Fallback
    const fixed = num.toFixed(2)
    return `₱${Number(fixed).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
  }
}

export function formatDateTime(ts) {
  const d = ts ? new Date(ts) : new Date()
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

export function countdownTo(ts) {
  const end = new Date(ts).getTime()
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return { expired: true, text: 'Expired' }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return { expired: false, text: `${days}d ${hours}h remaining` }
}

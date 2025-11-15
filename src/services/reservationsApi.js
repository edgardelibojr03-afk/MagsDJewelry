function authHeaders(token, json = false) {
  const h = {}
  if (json) h['Content-Type'] = 'application/json'
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export async function listReservations({ token }) {
  const res = await fetch('/api/reservations?action=list', { headers: authHeaders(token) })
  const { safeJson } = await import('./fetchHelpers')
  return safeJson(res)
}

export async function reserveDelta({ token }, { item_id, delta }) {
  const res = await fetch('/api/reservations', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify({ action: 'reserve', item_id, delta }) })
  const { safeJson } = await import('./fetchHelpers')
  return safeJson(res)
}

export async function cancelAllReservations({ token }) {
  const res = await fetch('/api/reservations?action=cancel_all', { headers: authHeaders(token) })
  const { safeJson } = await import('./fetchHelpers')
  return safeJson(res)
}

export async function cancelReservation({ token }, { reservation_id, item_id } = {}) {
  // Accept either reservation_id or item_id. Use POST with a JSON body so
  // server-side handler (which reads action from body on POST) recognizes it.
  const body = { action: 'cancel' }
  if (reservation_id) body.reservation_id = reservation_id
  if (item_id) body.item_id = item_id
  const res = await fetch('/api/reservations', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify(body) })
  const { safeJson } = await import('./fetchHelpers')
  return safeJson(res)
}

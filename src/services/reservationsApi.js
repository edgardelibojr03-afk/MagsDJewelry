function authHeaders(token, json = false) {
  const h = {}
  if (json) h['Content-Type'] = 'application/json'
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export async function listReservations({ token }) {
  const res = await fetch('/api/reservations/list', { headers: authHeaders(token) })
  return res.json()
}

export async function reserveDelta({ token }, { item_id, delta }) {
  const res = await fetch('/api/reservations/reserve', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ item_id, delta })
  })
  return res.json()
}

export async function cancelAllReservations({ token }) {
  const res = await fetch('/api/reservations/cancel_all', { headers: authHeaders(token) })
  return res.json()
}

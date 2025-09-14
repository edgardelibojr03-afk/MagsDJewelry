function authHeaders(token, json = false) {
  const h = {}
  if (json) h['Content-Type'] = 'application/json'
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export async function listItems({ token } = {}) {
  const res = await fetch('/api/admin/items/list', { headers: authHeaders(token) })
  return res.json()
}

export async function createItem({ token }, payload) {
  const res = await fetch('/api/admin/items/create', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload)
  })
  return res.json()
}

export async function updateItem({ token }, payload) {
  const res = await fetch('/api/admin/items/update', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload)
  })
  return res.json()
}

export async function deleteItem({ token }, id) {
  const res = await fetch('/api/admin/items/delete', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ id })
  })
  return res.json()
}

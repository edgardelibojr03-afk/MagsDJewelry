function authHeaders(token, json = false) {
  const h = {}
  if (json) h['Content-Type'] = 'application/json'
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export async function listItems({ token } = {}) {
  const res = await fetch('/api/admin/items?action=list', { headers: authHeaders(token) })
  return res.json()
}

export async function createItem({ token }, payload) {
  const res = await fetch('/api/admin/items', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify({ action: 'create', ...payload }) })
  return res.json()
}

export async function updateItem({ token }, payload) {
  const res = await fetch('/api/admin/items', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify({ action: 'update', ...payload }) })
  return res.json()
}

export async function deleteItem({ token }, id) {
  const res = await fetch('/api/admin/items', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify({ action: 'delete', id }) })
  return res.json()
}

export async function restockItem({ token }, { id, quantity }) {
  const res = await fetch('/api/admin/items', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify({ action: 'restock', id, quantity }) })
  return res.json()
}

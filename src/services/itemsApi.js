function authHeaders(token, json = false) {
  const h = {}
  if (json) h['Content-Type'] = 'application/json'
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export async function listItems({ token, filters } = {}) {
  const params = new URLSearchParams({ action: 'list' })
  if (filters?.category_type) params.set('category_type', filters.category_type)
  if (filters?.gold_type) params.set('gold_type', filters.gold_type)
  if (filters?.karat) params.set('karat', filters.karat)
  const res = await fetch(`/api/admin/items?${params.toString()}`, { headers: authHeaders(token) })
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

export async function deleteItem({ token }, id, { force } = {}) {
  const body = { action: 'delete', id }
  if (force === true) body.force = true
  const res = await fetch('/api/admin/items', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify(body) })
  return res.json()
}

export async function restockItem({ token }, { id, quantity }) {
  const res = await fetch('/api/admin/items', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify({ action: 'restock', id, quantity }) })
  return res.json()
}

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
  if (filters?.q) params.set('q', filters.q)
  const res = await fetch(`/api/admin/items?${params.toString()}`, { headers: authHeaders(token) })
  const { safeJson } = await import('./fetchHelpers')
  return safeJson(res)
}

export async function createItem({ token }, payload) {
  const res = await fetch('/api/admin/items', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify({ action: 'create', ...payload }) })
  const { safeJson } = await import('./fetchHelpers')
  return safeJson(res)
}

export async function updateItem({ token }, payload) {
  const res = await fetch('/api/admin/items', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify({ action: 'update', ...payload }) })
  const { safeJson } = await import('./fetchHelpers')
  return safeJson(res)
}

export async function deleteItem({ token }, id, { force } = {}) {
  const body = { action: 'delete', id }
  if (force === true) body.force = true
  const res = await fetch('/api/admin/items', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify(body) })
  const { safeJson } = await import('./fetchHelpers')
  return safeJson(res)
}

export async function restockItem({ token }, { id, quantity }) {
  const res = await fetch('/api/admin/items', { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify({ action: 'restock', id, quantity }) })
  const { safeJson } = await import('./fetchHelpers')
  return safeJson(res)
}

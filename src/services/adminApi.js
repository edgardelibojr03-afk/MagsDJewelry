const ADMIN_ENDPOINT = '/api/admin/users'

function buildHeaders({ secret, token, json = false } = {}) {
  const headers = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (secret) headers['x-admin-secret'] = secret
  else if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export async function fetchUsersFromAdmin({ secret, token } = {}) {
  const url = `${ADMIN_ENDPOINT}?action=list`
  const res = await fetch(url, { headers: buildHeaders({ secret, token }) })
  return res.json()
}

export async function createUserAdmin({ secret, token } = {}, payload) {
  const res = await fetch(ADMIN_ENDPOINT, { method: 'POST', headers: buildHeaders({ secret, token, json: true }), body: JSON.stringify({ action: 'create', ...payload }) })
  return res.json()
}

export async function updateUserAdmin({ secret, token } = {}, payload) {
  const res = await fetch(ADMIN_ENDPOINT, { method: 'POST', headers: buildHeaders({ secret, token, json: true }), body: JSON.stringify({ action: 'update', ...payload }) })
  return res.json()
}

export async function deleteUserAdmin({ secret, token } = {}, id) {
  const res = await fetch(ADMIN_ENDPOINT, { method: 'POST', headers: buildHeaders({ secret, token, json: true }), body: JSON.stringify({ action: 'delete', id }) })
  return res.json()
}

// New: admin list reservations for a user
export async function adminListReservations({ secret, token } = {}, user_id) {
  const url = `${ADMIN_ENDPOINT}?action=reservations&user_id=${encodeURIComponent(user_id)}`
  const res = await fetch(url, { headers: buildHeaders({ secret, token }) })
  return res.json()
}

const ADMIN_ENDPOINT = '/api/admin/list-users'

function buildHeaders({ secret, token, json = false } = {}) {
  const headers = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (secret) headers['x-admin-secret'] = secret
  else if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export async function fetchUsersFromAdmin({ secret, token } = {}) {
  const res = await fetch(ADMIN_ENDPOINT, {
    headers: buildHeaders({ secret, token })
  })
  return res.json()
}

export async function createUserAdmin({ secret, token } = {}, payload) {
  const res = await fetch('/api/admin/create-user', {
    method: 'POST',
    headers: buildHeaders({ secret, token, json: true }),
    body: JSON.stringify(payload)
  })
  return res.json()
}

export async function updateUserAdmin({ secret, token } = {}, payload) {
  const res = await fetch('/api/admin/update-user', {
    method: 'POST',
    headers: buildHeaders({ secret, token, json: true }),
    body: JSON.stringify(payload)
  })
  return res.json()
}

export async function deleteUserAdmin({ secret, token } = {}, id) {
  const res = await fetch('/api/admin/delete-user', {
    method: 'POST',
    headers: buildHeaders({ secret, token, json: true }),
    body: JSON.stringify({ id })
  })
  return res.json()
}

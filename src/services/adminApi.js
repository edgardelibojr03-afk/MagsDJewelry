const ADMIN_ENDPOINT = '/api/admin/list-users'

export async function fetchUsersFromAdmin(secret) {
  const res = await fetch(ADMIN_ENDPOINT, {
    headers: { 'x-admin-secret': secret }
  })
  return res.json()
}

export async function createUserAdmin(secret, payload) {
  const res = await fetch('/api/admin/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
    body: JSON.stringify(payload)
  })
  return res.json()
}

export async function updateUserAdmin(secret, payload) {
  const res = await fetch('/api/admin/update-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
    body: JSON.stringify(payload)
  })
  return res.json()
}

export async function deleteUserAdmin(secret, id) {
  const res = await fetch('/api/admin/delete-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
    body: JSON.stringify({ id })
  })
  return res.json()
}

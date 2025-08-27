const ADMIN_ENDPOINT = '/api/admin/list-users'

export async function fetchUsersFromAdmin(secret) {
  const res = await fetch(ADMIN_ENDPOINT, {
    headers: { 'x-admin-secret': secret }
  })
  return res.json()
}

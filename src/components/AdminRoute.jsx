import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/admin-login" replace />
  const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : []
  const isAdmin = Boolean(user?.app_metadata?.is_admin || user?.user_metadata?.is_admin || roles.includes('admin'))
  if (!isAdmin) return <Navigate to="/account" replace />
  if (user?.app_metadata?.blocked) return <Navigate to="/account" replace />
  return children
}

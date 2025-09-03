import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const handleLogin = async (e) => {
    e.preventDefault()
    const { data, error } = await signIn({ email, password })
    if (error) return setError(error.message)
    const u = data?.user
    const roles = Array.isArray(u?.app_metadata?.roles) ? u.app_metadata.roles : []
    const isAdmin = Boolean(u?.app_metadata?.is_admin || u?.user_metadata?.is_admin || roles.includes('admin'))
    if (!isAdmin) return setError('Not authorized as admin.')
    if (u?.app_metadata?.blocked) return setError('Your account is blocked.')
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>
        <input type="email" placeholder="Email" className="w-full p-2 border mb-4 rounded" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <div className="relative mb-4">
          <input type={showPassword? 'text':'password'} placeholder="Password" className="w-full p-2 border rounded pr-10" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" tabIndex={-1} onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword? 'Hide password':'Show password'}>
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Login</button>
        <div className="mt-4 text-center">
          <Link to="/login" className="text-blue-600 underline">Back to customer login</Link>
        </div>
      </form>
    </div>
  )
}

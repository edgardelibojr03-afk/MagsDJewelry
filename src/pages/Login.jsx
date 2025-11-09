import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import loginPic from '../assets/loginpic.png'
import googleLogo from '../assets/google.svg'
import logo from '../assets/logo.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { signIn, signInWithProvider } = useAuth()

  const handleLogin = async (e) => {
    e.preventDefault()
    const { data, error } = await signIn({ email, password })
    if (error) {
      setError(error.message)
    } else {
      const u = data?.user
      if (u?.app_metadata?.blocked) return setError('Your account is blocked.')
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="hidden lg:flex lg:flex-1 items-center justify-center bg-cover bg-center" style={{ backgroundImage: `url(${loginPic})` }} />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <div className="mb-6 text-center">
            <img src={logo} alt="Logo" className="mx-auto h-16" />
            <h2 className="text-2xl font-bold mt-4">Nice to see you</h2>
            <p className="text-sm text-gray-500">Sign in to continue to Mag's D. Jewelry</p>
          </div>

          <form onSubmit={handleLogin}>
            <label className="block text-sm text-gray-700">Email</label>
            <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full p-3 border rounded mb-4" />

            <label className="block text-sm text-gray-700">Password</label>
            <div className="relative mb-4">
              <input type={showPassword? 'text':'password'} required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-3 border rounded pr-10" />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" onClick={()=>setShowPassword(s=>!s)} aria-label="toggle password">{showPassword? 'Hide':'Show'}</button>
            </div>

            {error && <p className="text-red-500 mb-4">{error}</p>}

            <button className="w-full bg-blue-600 text-white py-3 rounded mb-3">Sign in</button>

            <button type="button" onClick={()=>signInWithProvider('google')} className="w-full border py-3 rounded flex items-center justify-center gap-2 mb-4">
              <img src={googleLogo} alt="Google" className="h-5 w-5" />
              <span>Or sign in with Google</span>
            </button>

              <div className="text-center text-sm text-gray-600">
                Don't have an account? <button type="button" className="text-blue-600 underline" onClick={()=>navigate('/register')}>Sign up now</button>
              </div>

              <div className="text-center mt-3">
                <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm text-gray-600 underline">Forgot password?</button>
              </div>
          </form>
        </div>
      </div>
    </div>
  )
}

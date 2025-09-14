import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export default function Header() {
  const { user } = useAuth()
  const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : []
  const isAdmin = Boolean(user?.app_metadata?.is_admin || user?.user_metadata?.is_admin || roles.includes('admin'))
  return (
    <header className="shadow" style={{ backgroundColor: '#F4EAE3' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="Logo" className="h-16 w-16 object-contain" />
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" aria-label="Home" title="Home" className="text-black">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 1-1.06 1.06l-.85-.85v6.06A2.25 2.25 0 0 1 17.06 21h-2.31a.75.75 0 0 1-.75-.75v-3.69a1.5 1.5 0 0 0-1.5-1.5h-1a1.5 1.5 0 0 0-1.5 1.5v3.69a.75.75 0 0 1-.75.75H5.94A2.25 2.25 0 0 1 3.69 18.8v-6.06l-.85.85a.75.75 0 1 1-1.06-1.06l8.69-8.69Z" />
              </svg>
            </Link>
            <Link to="/about" aria-label="About" title="About" className="text-black">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5ZM10.5 9a1.5 1.5 0 1 1 3.001.001A1.5 1.5 0 0 1 10.5 9ZM9.75 12a.75.75 0 0 1 .75-.75h.75v4.5h-.75a.75.75 0 0 1 0-1.5h0v-2.25Zm3 0a.75.75 0 0 1 .75-.75h.75v4.5h-.75a.75.75 0 0 1 0-1.5h0v-2.25Z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link to="/products" aria-label="Products" title="Products" className="text-black">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z" />
              </svg>
            </Link>
            {user && (
              <Link to="/cart" aria-label="Cart" title="Cart" className="text-black">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M2.25 3.75A.75.75 0 0 1 3 3h1.386a1.5 1.5 0 0 1 1.447 1.105L6.6 6h12.9a.75.75 0 0 1 .728.934l-1.5 6A.75.75 0 0 1 18 13.5H7.2l-.3 1.2a1.5 1.5 0 0 1-1.447 1.1H4.5a.75.75 0 0 1 0-1.5h.953l1.8-7.2L6.05 5.2a.001.001 0 0 0-.001-.001H3a.75.75 0 0 1-.75-.75Zm5.25 14.25a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm9-1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
                </svg>
              </Link>
            )}
            <Link to="/account" aria-label="Account" title="Account" className="text-black">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M12 2.25a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm-7.5 18a7.5 7.5 0 1 1 15 0v.75H4.5V20.25Z" clipRule="evenodd" />
              </svg>
            </Link>
            {isAdmin && (
              <Link to="/dashboard" aria-label="Dashboard" title="Dashboard" className="text-black">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z" />
                </svg>
              </Link>
            )}
          </nav>

          <div className="md:hidden">
            {/* Mobile menu could go here later */}
            <button aria-label="menu" className="p-2 rounded text-gray-700">☰</button>
          </div>
        </div>
      </div>
    </header>
  )
}

import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

export default function Header() {
  return (
    <header className="shadow" style={{ backgroundColor: '#F4EAE3' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="Logo" className="h-12 w-12 object-contain" />
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm text-black">Home</Link>
            <Link to="/about" className="text-sm text-black">About</Link>
            <Link to="/products" className="text-sm text-black">Products</Link>
            {/* Cart link removed to avoid exposing admin dashboard via /cart */}
            <Link to="/account" className="text-sm text-black">Account</Link>
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

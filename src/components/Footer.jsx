import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

export default function Footer() {
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <footer className="bg-gray-100 mt-12 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="h-10 w-10 object-contain" />
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" aria-label="Home" title="Home" className="text-black">
            Home
          </Link>
          <Link to="/about" aria-label="About" title="About" className="text-black">
            About
          </Link>
          <Link to="/products" aria-label="Products" title="Products" className="text-black">
            Products
          </Link>
          <a href="https://www.facebook.com/magsdjewelry" aria-label="Facebook" title="Facebook" target="_blank" rel="noreferrer" className="text-black">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M22.675 0H1.325A1.326 1.326 0 0 0 0 1.325v21.351C0 23.403.597 24 1.325 24h11.495v-9.294H9.691V11.01h3.129V8.413c0-3.1 1.894-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24h-1.917c-1.504 0-1.796.716-1.796 1.767v2.316h3.59l-.467 3.696h-3.123V24h6.127A1.326 1.326 0 0 0 24 22.676V1.325A1.326 1.326 0 0 0 22.675 0z"/>
            </svg>
          </a>
        </nav>

        <button onClick={scrollTop} className="bg-black text-white px-3 py-2 rounded" style={{ backgroundColor: '#1B1611' }}>
          Back to top
        </button>
      </div>
    </footer>
  )
}

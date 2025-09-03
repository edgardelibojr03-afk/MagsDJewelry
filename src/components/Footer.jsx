import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

export default function Footer() {
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <footer className="bg-gray-100 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="h-10 w-10 object-contain" />
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm">Home</Link>
          <Link to="/about" className="text-sm">About</Link>
          <Link to="/products" className="text-sm">Products</Link>
          <a href="https://www.facebook.com/magsdjewelry" target="_blank" rel="noreferrer" className="text-sm">Facebook</a>
        </nav>

        <button onClick={scrollTop} className="bg-black text-white px-3 py-2 rounded" style={{ backgroundColor: '#1B1611' }}>
          Back to top
        </button>
      </div>
    </footer>
  )
}

// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Login from './pages/login'
import AdminLogin from './pages/AdminLogin'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Account from './pages/Account'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/cart" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/products" element={<Home />} />
          <Route path="/about" element={<Home />} />
        </Routes>
        <Footer />
      </AuthProvider>
    </Router>
  )
}

export default App

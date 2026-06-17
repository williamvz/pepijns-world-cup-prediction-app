import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import Avatar from './Avatar'

export default function TopNav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    api.getNotifications()
      .then((data) => {
        setUnreadCount(data.unread_count ?? 0)
      })
      .catch(() => {})
  }, [])

  const handleBellClick = () => {
    if (unreadCount > 0) {
      api.markAllRead().catch(() => {})
      setUnreadCount(0)
    }
    navigate('/')
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navLinks = [
    { to: '/', label: 'Home', exact: true },
    { to: '/wedstrijden', label: 'Wedstrijden' },
    { to: '/ranglijst', label: 'Ranglijst' },
    { to: '/profiel', label: 'Profiel' },
  ]

  if (user?.role === 'admin') {
    navLinks.push({ to: '/admin', label: 'Admin' })
  }

  return (
    <header className="hidden md:flex fixed top-0 left-0 right-0 z-40 bg-pitch-900/95 backdrop-blur-md border-b border-white/10 h-16 items-center px-6">
      <NavLink to="/" className="flex items-center gap-2 mr-8">
        <span className="text-2xl">⚽</span>
        <span className="font-heading font-black text-xl text-white">WK Pool 2026</span>
      </NavLink>

      <nav className="flex items-center gap-1 flex-1">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.exact}
            className={({ isActive }) =>
              `px-4 py-2 rounded-lg font-heading font-bold text-sm transition-all ${
                isActive
                  ? 'bg-gold-500/20 text-gold-400'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          className="relative p-2 rounded-lg hover:bg-white/10 transition-all"
          onClick={handleBellClick}
          title="Meldingen"
        >
          <span className="text-xl">🔔</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 hover:bg-white/10 rounded-xl px-3 py-2 transition-all"
            onClick={() => setShowUserMenu((v) => !v)}
          >
            <Avatar avatar={user?.avatar} size="sm" />
            <span className="font-heading font-bold text-sm text-white">{user?.username}</span>
            <span className="text-white/40 text-xs">▾</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 bg-pitch-800 border border-white/10 rounded-xl shadow-2xl w-48 overflow-hidden z-50">
              <NavLink
                to="/profiel"
                className="block px-4 py-3 hover:bg-white/10 text-sm font-heading transition-all"
                onClick={() => setShowUserMenu(false)}
              >
                👤 Mijn profiel
              </NavLink>
              {user?.role === 'admin' && (
                <NavLink
                  to="/admin"
                  className="block px-4 py-3 hover:bg-white/10 text-sm font-heading transition-all text-gold-400"
                  onClick={() => setShowUserMenu(false)}
                >
                  ⚙️ Admin paneel
                </NavLink>
              )}
              <button
                className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm font-heading transition-all text-red-400"
                onClick={handleLogout}
              >
                🚪 Uitloggen
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../../services/api'

const TABS = [
  { to: '/', label: 'Home', emoji: '🏠', exact: true },
  { to: '/wedstrijden', label: 'Wedstrijden', emoji: '⚽' },
  { to: '/ranglijst', label: 'Ranglijst', emoji: '🏆' },
  { to: '/prestaties', label: 'Prestaties', emoji: '🏅' },
  { to: '/profiel', label: 'Profiel', emoji: '👤' },
]

export default function BottomNav() {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const refresh = () => {
      api.getNotifications()
        .then((data) => {
          const count = data.unread_count ?? (data.notifications || []).filter((n) => !n.read).length
          setUnreadCount(count)
        })
        .catch(() => {})
    }
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-pitch-900/95 backdrop-blur-md border-t border-white/10 md:hidden">
      <div className="flex">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.exact}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 transition-all ${
                isActive ? 'text-gold-400' : 'text-white/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <span className="text-xl leading-none">{tab.emoji}</span>
                  {tab.to === '/' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-heading leading-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-gold-400 mt-0.5" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
      {/* Safe area padding for iPhone */}
      <div className="h-safe-area-inset-bottom" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </nav>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoadingSpinner from './components/common/LoadingSpinner'
import BottomNav from './components/common/BottomNav'
import TopNav from './components/common/TopNav'
import AchievementPopup from './components/common/AchievementPopup'
import LoginPage from './components/auth/LoginPage'
import Home from './pages/Home'
import Matches from './pages/Matches'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import Achievements from './pages/Achievements'
import AdminPanel from './pages/AdminPanel'
import { api } from './services/api'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function AppLayout({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-pitch-900 field-bg">
      {/* Desktop top nav */}
      <TopNav />

      {/* Main content */}
      <main className="md:pt-16 pb-20 md:pb-6 min-h-screen">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const [pendingAchievement, setPendingAchievement] = useState(null)
  const [seenAchievements, setSeenAchievements] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wkpool_seen_achievements') || '[]')
    } catch {
      return []
    }
  })
  // Ref keeps the latest seen list accessible inside the interval without stale closure
  const seenRef = useRef(seenAchievements)

  // Poll for new achievements
  useEffect(() => {
    if (!user) return

    let isMounted = true

    async function checkAchievements() {
      try {
        const data = await api.getMyAchievements()
        const achievements = data.achievements || data || []
        const seen = new Set(seenRef.current)

        for (const ach of achievements) {
          const key = ach.id || ach.achievement_id
          if (!seen.has(key)) {
            if (isMounted) {
              setPendingAchievement(ach)
              const newSeen = [...seen, key]
              seenRef.current = newSeen
              setSeenAchievements(newSeen)
              localStorage.setItem('wkpool_seen_achievements', JSON.stringify(newSeen))
            }
            break
          }
        }
      } catch {
        // Silently ignore achievement check errors
      }
    }

    // Check on mount
    checkAchievements()

    // Check every 60 seconds
    const interval = setInterval(checkAchievements, 60000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [user])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <>
      <Routes>
        {/* Auth routes */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Home />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/wedstrijden"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Matches />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        {/* Predictions live on the unified Wedstrijden page now; keep the old
            path working for bookmarks by redirecting. */}
        <Route path="/voorspellingen" element={<Navigate to="/wedstrijden" replace />} />
        <Route
          path="/ranglijst"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Leaderboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profiel"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Profile />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/prestaties"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Achievements />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AppLayout>
                <AdminPanel />
              </AppLayout>
            </AdminRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global achievement popup */}
      {pendingAchievement && (
        <AchievementPopup
          achievement={pendingAchievement}
          onDismiss={() => setPendingAchievement(null)}
        />
      )}
    </>
  )
}

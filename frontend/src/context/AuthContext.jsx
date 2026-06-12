import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('wkpool_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function restoreSession() {
      const storedToken = localStorage.getItem('wkpool_token')
      if (!storedToken) {
        setLoading(false)
        return
      }
      try {
        const data = await api.me()
        setUser(data.user || data)
      } catch {
        localStorage.removeItem('wkpool_token')
        setToken(null)
      } finally {
        setLoading(false)
      }
    }
    restoreSession()
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password)
    const { token: newToken, user: newUser } = data
    localStorage.setItem('wkpool_token', newToken)
    setToken(newToken)
    setUser(newUser)
    return newUser
  }, [])

  const register = useCallback(async (registerData) => {
    const data = await api.register(registerData)
    const { token: newToken, user: newUser } = data
    localStorage.setItem('wkpool_token', newToken)
    setToken(newToken)
    setUser(newUser)
    return newUser
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('wkpool_token')
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback(async (data) => {
    const updated = await api.updateMe(data)
    setUser(updated.user || updated)
    return updated
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

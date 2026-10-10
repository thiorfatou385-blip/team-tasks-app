import { createContext, useContext, useState, type ReactNode } from 'react'
import api from '../api/axios'
import type { AuthResponse, User } from '../types'

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<User>
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? (JSON.parse(stored) as User) : null
  })

  function storeUser(next: User) {
    localStorage.setItem('user', JSON.stringify(next))
    setUser(next)
  }

  async function login(email: string, password: string) {
    const { data } = await api.post<AuthResponse>('/login', { email, password })
    localStorage.setItem('token', data.token)
    storeUser(data.user)
    return data.user
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const { data } = await api.post<User>('/change-password', { current_password: currentPassword, new_password: newPassword })
    storeUser(data)
    return data
  }

  async function logout() {
    try {
      await api.post('/logout')
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider')
  return ctx
}

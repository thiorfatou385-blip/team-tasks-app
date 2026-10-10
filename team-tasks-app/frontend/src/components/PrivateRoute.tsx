import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'
import type { UserRole } from '../types'

interface PrivateRouteProps { children: ReactNode; roles?: UserRole[] }

export default function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace />
  if (user.must_change_password && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />

  return children
}

import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'

const ROLE_LABELS: Record<UserRole, string> = {
  manager: 'Manager',
  lead_dev: 'Lead développeur',
  developer: 'Développeur',
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user || user.must_change_password) return null

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <NavLink to="/" end className="navbar-brand"><span className="navbar-logo">✓</span>Gestion des tâches</NavLink>
        <NavLink to="/" end>Accueil</NavLink>
        <NavLink to="/projects">Projets</NavLink>
        {user.role === 'manager' && <NavLink to="/users">Utilisateurs</NavLink>}
      </div>
      <div className="navbar-right">
        <span className="navbar-user">{user.name} — {ROLE_LABELS[user.role]}</span>
        <NavLink to="/change-password">Mot de passe</NavLink>
        <button onClick={handleLogout}>Déconnexion</button>
      </div>
    </nav>
  )
}

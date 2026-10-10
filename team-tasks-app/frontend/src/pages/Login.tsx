import { useState } from 'react' // TypeScript component
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const loggedUser = await login(email, password)
      navigate(loggedUser.must_change_password ? '/change-password' : '/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Connexion impossible.')
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-brand"><span className="navbar-logo">✓</span>Gestion des tâches</div>
        <h1>Connexion</h1>
        <p className="muted">Connectez-vous pour accéder à votre espace de travail.</p>
        {error && <p className="error">{error}</p>}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit">Se connecter</button>
      </form>
    </div>
  )
}

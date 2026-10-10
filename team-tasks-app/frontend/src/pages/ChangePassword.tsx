import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ChangePassword() {
  const { user, changePassword } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    try {
      await changePassword(currentPassword, newPassword)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Impossible de changer le mot de passe.')
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-brand"><span className="navbar-logo">✓</span>Gestion des tâches</div>
        <h1>Changer le mot de passe</h1>
        {user?.must_change_password && (
          <p className="muted">Première connexion : choisissez un nouveau mot de passe pour continuer.</p>
        )}
        {error && <p className="error">{error}</p>}
        <label>
          Mot de passe actuel
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </label>
        <label>
          Nouveau mot de passe (8 caractères minimum)
          <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </label>
        <label>
          Confirmer le nouveau mot de passe
          <input type="password" minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
        </label>
        <button type="submit">Enregistrer</button>
      </form>
    </div>
  )
}

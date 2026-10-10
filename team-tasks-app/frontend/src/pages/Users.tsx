import { useEffect, useState, type FormEvent } from 'react' // TypeScript component
import api from '../api/axios'
import type { Project, User, UserRole } from '../types'

const EMPTY_FORM = { name: '', email: '', password: '', role: 'developer' as UserRole, github_username: '', project_ids: [] as number[] }
const ROLE_LABELS: Record<UserRole, string> = { manager: 'Manager', lead_dev: 'Lead développeur', developer: 'Développeur' }

type UserForm = typeof EMPTY_FORM

function ProjectPicker({ projects, value, onChange }: { projects: Project[]; value: number[]; onChange: (ids: number[]) => void }) {
  if (projects.length === 0) return <span className="muted">Aucun projet</span>
  return (
    <div className="checkbox-list">
      {projects.map((p) => (
        <label key={p.id}>
          <input
            type="checkbox"
            checked={value.includes(p.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((id) => id !== p.id))}
          />
          {p.name}
        </label>
      ))}
    </div>
  )
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [createForm, setCreateForm] = useState<UserForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_FORM)
  const [error, setError] = useState('')

  async function loadUsers() {
    try {
      const { data } = await api.get<User[]>('/users')
      setUsers(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Impossible de charger les utilisateurs.')
    }
  }

  useEffect(() => {
    loadUsers()
    api.get<Project[]>('/projects').then((res) => setProjects(res.data))
  }, [])

  const projectNames = (ids: number[] = []) => projects.filter((p) => ids.includes(p.id)).map((p) => p.name).join(', ')

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/users', createForm)
      setCreateForm(EMPTY_FORM)
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || "Impossible de créer l'utilisateur.")
    }
  }

  function startEditing(user: User) {
    setError('')
    setEditingId(user.id)
    setEditForm({ name: user.name, email: user.email, password: '', role: user.role, github_username: user.github_username || '', project_ids: user.project_ids || [] })
  }

  async function handleUpdate(e: FormEvent, user: User) {
    e.preventDefault()
    setError('')
    const payload: Partial<UserForm> = { ...editForm }
    if (!payload.password) delete payload.password
    if (user.role === 'manager') delete payload.role
    if (editForm.role !== 'developer') delete payload.project_ids
    try {
      await api.put(`/users/${user.id}`, payload)
      setEditingId(null)
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || "Impossible de modifier l'utilisateur.")
    }
  }

  async function handleToggleActive(user: User) {
    setError('')
    try {
      await api.patch(`/users/${user.id}/status`, { is_active: !user.is_active })
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || "Impossible de modifier le statut de l'utilisateur.")
    }
  }

  async function handleDelete(user: User) {
    if (!window.confirm(`Supprimer l'utilisateur ${user.name} ?`)) return
    setError('')
    try {
      await api.delete(`/users/${user.id}`)
      if (editingId === user.id) setEditingId(null)
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || "Impossible de supprimer l'utilisateur.")
    }
  }

  return (
    <div className="page">
      <h1>Utilisateurs</h1>

      <form onSubmit={handleCreate} className="card-form">
        <h2>Nouvel utilisateur</h2>
        <div className="inline-form">
          <input placeholder="Nom" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          <input type="email" placeholder="Email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
          <input type="password" placeholder="Mot de passe (8 car. min.)" minLength={8} value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required />
          <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}>
            <option value="developer">Développeur</option>
            <option value="lead_dev">Lead développeur</option>
          </select>
          <input placeholder="Utilisateur GitHub (optionnel)" value={createForm.github_username} onChange={(e) => setCreateForm({ ...createForm, github_username: e.target.value })} />
        </div>
        {createForm.role === 'developer' ? (
          <div className="field">
            <span className="muted">Inclure dans les projets :</span>
            <ProjectPicker projects={projects} value={createForm.project_ids} onChange={(ids) => setCreateForm({ ...createForm, project_ids: ids })} />
          </div>
        ) : (
          <p className="muted">Un Lead développeur est rattaché à un projet lors de la création du projet.</p>
        )}
        <button type="submit">Créer l'utilisateur</button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="table-wrapper">
        <table className="table">
          <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Projets</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((user) => editingId === user.id ? (
              <tr key={user.id}>
                <td>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required form={`edit-user-${user.id}`} />
                  <input className="edit-password" placeholder="GitHub" value={editForm.github_username} onChange={(e) => setEditForm({ ...editForm, github_username: e.target.value })} form={`edit-user-${user.id}`} />
                </td>
                <td>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required form={`edit-user-${user.id}`} />
                  <input className="edit-password" type="password" minLength={8} placeholder="Nouveau mot de passe (optionnel)" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} form={`edit-user-${user.id}`} />
                </td>
                <td>
                  {user.role === 'manager' ? ROLE_LABELS.manager : (
                    <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })} form={`edit-user-${user.id}`}>
                      <option value="developer">Développeur</option>
                      <option value="lead_dev">Lead développeur</option>
                    </select>
                  )}
                </td>
                <td>
                  {editForm.role === 'developer'
                    ? <ProjectPicker projects={projects} value={editForm.project_ids} onChange={(ids) => setEditForm({ ...editForm, project_ids: ids })} />
                    : '—'}
                </td>
                <td>{user.is_active ? 'Actif' : 'Désactivé'}</td>
                <td className="user-actions">
                  <form id={`edit-user-${user.id}`} onSubmit={(e) => handleUpdate(e, user)}><button type="submit">Enregistrer</button></form>
                  <button type="button" className="secondary" onClick={() => setEditingId(null)}>Annuler</button>
                </td>
              </tr>
            ) : (
              <tr key={user.id} className={user.is_active ? '' : 'inactive-row'}>
                <td>{user.name}{user.github_username && <div className="muted">@{user.github_username}</div>}</td>
                <td>{user.email}</td>
                <td>{ROLE_LABELS[user.role]}</td>
                <td>{user.role === 'developer' ? projectNames(user.project_ids) || '—' : '—'}</td>
                <td><span className={`badge ${user.is_active ? 'badge-done' : 'badge-predefined'}`}>{user.is_active ? 'Actif' : 'Désactivé'}</span></td>
                <td className="user-actions">
                  <button type="button" onClick={() => startEditing(user)}>Modifier</button>
                  {user.role !== 'manager' && (
                    <>
                      <button type="button" className="secondary" onClick={() => handleToggleActive(user)}>{user.is_active ? 'Désactiver' : 'Activer'}</button>
                      <button type="button" className="danger" onClick={() => handleDelete(user)}>Supprimer</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

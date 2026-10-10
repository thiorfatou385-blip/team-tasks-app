import { useEffect, useState, type FormEvent } from 'react' // TypeScript component
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import type { Project, User } from '../types'

const EMPTY_FORM = { name: '', description: '', lead_dev_id: '', github_repo: '', github_default_branch: 'main', member_ids: [] as number[] }

export default function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [leadDevs, setLeadDevs] = useState<User[]>([])
  const [developers, setDevelopers] = useState<User[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  function loadProjects() {
    api.get<Project[]>('/projects').then((res) => setProjects(res.data))
  }

  useEffect(() => {
    loadProjects()
    if (user.role === 'manager') {
      api.get<User[]>('/users', { params: { role: 'lead_dev' } }).then((res) => setLeadDevs(res.data.filter((u) => u.is_active)))
      api.get<User[]>('/users', { params: { role: 'developer' } }).then((res) => setDevelopers(res.data.filter((u) => u.is_active)))
    }
  }, [user.role])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/projects', form)
      setForm(EMPTY_FORM)
      loadProjects()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Impossible de créer le projet.')
    }
  }

  function toggleMember(id: number, checked: boolean) {
    setForm({ ...form, member_ids: checked ? [...form.member_ids, id] : form.member_ids.filter((m) => m !== id) })
  }

  return (
    <div className="page">
      <h1>Projets</h1>

      {user.role === 'manager' && (
        <form onSubmit={handleSubmit} className="card-form">
          <h2>Nouveau projet</h2>
          <div className="inline-form">
            <input
              placeholder="Nom du projet"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <select
              value={form.lead_dev_id}
              onChange={(e) => setForm({ ...form, lead_dev_id: e.target.value })}
              required
            >
              <option value="">— Lead développeur (obligatoire) —</option>
              {leadDevs.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <input
              placeholder="owner/repo GitHub (optionnel)"
              value={form.github_repo}
              onChange={(e) => setForm({ ...form, github_repo: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="muted">Développeurs du projet :</span>
            {developers.length === 0 ? <span className="muted">Aucun développeur actif — créez-en depuis la page Utilisateurs.</span> : (
              <div className="checkbox-list">
                {developers.map((d) => (
                  <label key={d.id}>
                    <input type="checkbox" checked={form.member_ids.includes(d.id)} onChange={(e) => toggleMember(d.id, e.target.checked)} />
                    {d.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          {leadDevs.length === 0 && <p className="muted">Créez d'abord un Lead développeur depuis la page Utilisateurs.</p>}
          <button type="submit">Créer le projet</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <ul className="project-list">
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`}>{p.name}</Link>
            <span className="muted">Manager : {p.manager?.name} · Lead dev : {p.lead_dev?.name} · {p.members.length} développeur(s)</span>
          </li>
        ))}
        {projects.length === 0 && <p className="muted">Aucun projet pour l'instant.</p>}
      </ul>
    </div>
  )
}

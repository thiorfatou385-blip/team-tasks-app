import { useEffect, useState, type FormEvent } from 'react' // TypeScript component
import { useParams } from 'react-router-dom'
import api from '../api/axios'
import TaskCard from '../components/TaskCard'
import { useAuth } from '../context/AuthContext'
import type { Project, Task, User } from '../types'

export default function ProjectDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [form, setForm] = useState({ title: '', description: '', start_date: '' })
  const [error, setError] = useState('')
  // Gestion de l'équipe (Manager)
  const [allLeads, setAllLeads] = useState<User[]>([])
  const [allDevelopers, setAllDevelopers] = useState<User[]>([])
  const [teamForm, setTeamForm] = useState({ lead_dev_id: '', member_ids: [] as number[] })
  const [teamMessage, setTeamMessage] = useState('')

  function loadAll() {
    api.get<Project>(`/projects/${id}`).then((res) => {
      setProject(res.data)
      setTeamForm({ lead_dev_id: String(res.data.lead_dev_id), member_ids: res.data.members.map((m) => m.id) })
    }).catch((err) => setError(err.response?.data?.message || 'Projet introuvable.'))
    api.get<Task[]>(`/projects/${id}/tasks`).then((res) => setTasks(res.data)).catch(() => {})
  }

  const isManager = user.role === 'manager'

  useEffect(() => {
    loadAll()
    if (isManager) {
      api.get<User[]>('/users', { params: { role: 'lead_dev' } }).then((res) => setAllLeads(res.data))
      api.get<User[]>('/users', { params: { role: 'developer' } }).then((res) => setAllDevelopers(res.data))
    }
  }, [id])

  const isLeadDev = project && user.role === 'lead_dev' && project.lead_dev_id === user.id
  const developers = project ? project.members.filter((m) => m.is_active) : []

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.post(`/projects/${id}/tasks`, form)
      setForm({ title: '', description: '', start_date: '' })
      loadAll()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Impossible de créer la tâche.')
    }
  }

  async function handleSaveTeam(e: FormEvent) {
    e.preventDefault()
    setError('')
    setTeamMessage('')
    try {
      await api.put(`/projects/${id}`, teamForm)
      setTeamMessage('Équipe mise à jour.')
      loadAll()
    } catch (err: any) {
      setError(err.response?.data?.message || "Impossible de mettre à jour l'équipe.")
    }
  }

  function toggleMember(memberId: number, checked: boolean) {
    setTeamForm({ ...teamForm, member_ids: checked ? [...teamForm.member_ids, memberId] : teamForm.member_ids.filter((m) => m !== memberId) })
  }

  if (!project) return <div className="page">{error ? <p className="error">{error}</p> : 'Chargement…'}</div>

  // Les développeurs désactivés restent visibles s'ils sont encore membres, pour pouvoir les retirer
  const selectableDevelopers = allDevelopers.filter((d) => d.is_active || teamForm.member_ids.includes(d.id))

  return (
    <div className="page">
      <h1>{project.name}</h1>
      <p className="muted">
        Manager : {project.manager?.name} · Lead développeur : {project.lead_dev?.name}
        {project.github_repo && <> · Dépôt GitHub : {project.github_repo}</>}
      </p>
      {project.description && <p>{project.description}</p>}
      <p className="muted">Développeurs : {project.members.map((m) => m.name).join(', ') || 'aucun'}</p>

      {isManager && (
        <form onSubmit={handleSaveTeam} className="card-form">
          <h2>Équipe du projet</h2>
          <div className="inline-form">
            <select value={teamForm.lead_dev_id} onChange={(e) => setTeamForm({ ...teamForm, lead_dev_id: e.target.value })} required>
              {allLeads.filter((l) => l.is_active || String(l.id) === teamForm.lead_dev_id).map((l) => (
                <option key={l.id} value={l.id}>{l.name} (Lead développeur)</option>
              ))}
            </select>
          </div>
          <div className="checkbox-list">
            {selectableDevelopers.map((d) => (
              <label key={d.id}>
                <input type="checkbox" checked={teamForm.member_ids.includes(d.id)} onChange={(e) => toggleMember(d.id, e.target.checked)} />
                {d.name}{!d.is_active && ' (désactivé)'}
              </label>
            ))}
            {selectableDevelopers.length === 0 && <span className="muted">Aucun développeur actif.</span>}
          </div>
          <button type="submit">Enregistrer l'équipe</button>
          {teamMessage && <span className="muted"> {teamMessage}</span>}
        </form>
      )}

      {isLeadDev && (
        <form onSubmit={handleCreateTask} className="inline-form">
          <input
            placeholder="Titre de la tâche"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <label className="muted">
            Date de démarrage{' '}
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
          </label>
          <button type="submit">Créer la tâche</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <div className="task-list">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} project={project} developers={developers} onChange={loadAll} />
        ))}
        {tasks.length === 0 && <p className="muted">Aucune tâche pour l'instant.</p>}
      </div>
    </div>
  )
}

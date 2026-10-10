import { useState } from 'react' // TypeScript component
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const STATUS_LABELS = {
  predefined: 'Prédéfinie',
  assigned: 'Assignée',
  in_progress: 'En cours',
  done: 'Terminée',
}

export default function TaskCard({ task, project, developers, onChange }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [branchInfo, setBranchInfo] = useState(null)

  const isLeadDev = user.role === 'lead_dev' && project.lead_dev_id === user.id
  const isAssignee = task.assigned_to === user.id
  // Une tâche libre devient prenable par tout développeur 3 jours après sa création
  const isAvailable = new Date(task.available_at).getTime() <= Date.now()
  const formatDate = (value: string) => new Date(value).toLocaleDateString('fr-FR')

  async function run(action) {
    setBusy(true)
    setError('')
    try {
      await action()
      onChange()
    } catch (err) {
      setError(err.response?.data?.message || 'Action impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAssign() {
    if (!assignTo) return
    await run(() => api.post(`/tasks/${task.id}/assign`, { developer_id: assignTo }))
  }

  async function handleCreateBranch() {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post(`/tasks/${task.id}/github-branch`)
      setBranchInfo(data)
      onChange()
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de créer la branche GitHub.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`task-card task-card-${task.status}`}>
      <div className="task-header">
        <strong>{task.title}</strong>
        <span className={`badge badge-${task.status}`}>{STATUS_LABELS[task.status]}</span>
      </div>
      {task.description && <p className="muted">{task.description}</p>}
      <p className="muted">
        Début prévu : {task.start_date.split('-').reverse().join('/')} · Créée le {formatDate(task.created_at)}{' '}
        {task.assignee ? `· Assignée à ${task.assignee.name}` : '· Non assignée'}
      </p>
      {task.status === 'assigned' && (
        <p className="muted">À démarrer avant le lendemain de la date prévue, sinon la tâche sera libérée.</p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="task-actions">
        {/* Développeur : prendre une tâche libre */}
        {user.role === 'developer' && task.status === 'predefined' && !task.assigned_to && (isAvailable ? (
          <button disabled={busy} onClick={() => run(() => api.post(`/tasks/${task.id}/take`))}>
            Prendre cette tâche
          </button>
        ) : (
          <span className="muted">Prenable à partir du {formatDate(task.available_at)}</span>
        ))}

        {/* Développeur assigné : démarrer / terminer */}
        {user.role === 'developer' && isAssignee && task.status === 'assigned' && (
          <button disabled={busy} onClick={() => run(() => api.post(`/tasks/${task.id}/start`))}>
            Marquer en cours
          </button>
        )}
        {user.role === 'developer' && isAssignee && task.status === 'in_progress' && (
          <button disabled={busy} onClick={() => run(() => api.post(`/tasks/${task.id}/complete`))}>
            Marquer terminée
          </button>
        )}

        {/* Lead dev : assigner / libérer */}
        {isLeadDev && ['predefined'].includes(task.status) && (
          <div className="assign-row">
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="">— Choisir un développeur —</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button disabled={busy || !assignTo} onClick={handleAssign}>Assigner</button>
          </div>
        )}
        {isLeadDev && task.status === 'assigned' && (
          <button disabled={busy} onClick={() => run(() => api.post(`/tasks/${task.id}/release`))}>
            Libérer (non démarrée à temps)
          </button>
        )}

        {/* GitHub : créer une branche depuis la tâche */}
        {(isLeadDev || isAssignee) && (
          <button disabled={busy} onClick={handleCreateBranch}>
            {task.github_branch ? `Branche : ${task.github_branch}` : 'Créer une branche GitHub'}
          </button>
        )}
        {branchInfo?.url && (
          <a href={branchInfo.url} target="_blank" rel="noreferrer">Voir la branche</a>
        )}
      </div>
    </div>
  )
}

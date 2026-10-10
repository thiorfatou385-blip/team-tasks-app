import { useEffect, useState, type ReactNode } from 'react' // TypeScript component
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import type { Task, UserRole } from '../types'

interface DashboardProject { id: number; name: string; lead_dev: string; members: number; total: number; done: number; active: number }
interface Dashboard {
  stats: { projects: number; active_tasks: number; done_tasks: number; active_members: number }
  free_tasks: number
  projects: DashboardProject[]
  tasks: (Task & { project_id: number; project_name: string })[]
}

const ROLE_LABELS: Record<UserRole, string> = { manager: 'Manager', lead_dev: 'Lead développeur', developer: 'Développeur' }
const SUBTITLES: Record<UserRole, string> = {
  manager: "Pilotez vos projets, constituez les équipes et suivez l'avancement en un coup d'œil.",
  lead_dev: "Planifiez les tâches, répartissez le travail et gardez l'équipe sur les rails.",
  developer: 'Retrouvez vos tâches, démarrez à temps et faites avancer vos projets.',
}
const STATUS_LABELS: Record<string, string> = { predefined: 'Prédéfinie', assigned: 'Assignée', in_progress: 'En cours', done: 'Terminée' }

const svg = (path: ReactNode, size = 20) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
)
const ICONS = {
  projects: svg(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>),
  active: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  done: svg(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  members: svg(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  plus: svg(<path d="M12 5v14M5 12h14" />, 18),
  userPlus: svg(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>, 18),
  shield: svg(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />, 18),
  hand: svg(<><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></>, 18),
  folder: svg(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />, 18),
  key: svg(<><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3M16 7l3 3M19 4l2 2" /></>, 18),
  arrow: svg(<path d="M5 12h14M13 6l6 6-6 6" />, 16),
}

const formatDay = (isoDate: string) => isoDate.split('-').reverse().slice(0, 2).join('/')
// Une tâche assignée dont la date de démarrage est passée doit être démarrée rapidement, sinon elle sera libérée
const isLate = (task: Task) => task.status === 'assigned' && new Date(`${task.start_date}T00:00:00`).getTime() < Date.now()

function QuickAction({ to, icon, title, hint }: { to: string; icon: ReactNode; title: string; hint: string }) {
  return (
    <Link to={to} className="quick-action">
      <span className="quick-action-icon">{icon}</span>
      <span className="quick-action-text"><strong>{title}</strong><small>{hint}</small></span>
      <span className="quick-action-arrow">{ICONS.arrow}</span>
    </Link>
  )
}

export default function Home() {
  const { user } = useAuth()
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  // L'image d'illustration est optionnelle : frontend/public/hero.jpg
  const [hasImage, setHasImage] = useState(true)

  useEffect(() => {
    api.get<Dashboard>('/dashboard').then((res) => setData(res.data)).catch(() => setError('Impossible de charger le tableau de bord.'))
  }, [])

  const firstName = user.name.split(' ')[0]
  const now = new Date()
  const greeting = now.getHours() >= 18 ? 'Bonsoir' : 'Bonjour'
  const today = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const isDeveloper = user.role === 'developer'
  const firstProject = data?.projects[0]

  const stats = [
    { key: 'projects', label: 'Projets accessibles', value: data?.stats.projects },
    { key: 'active', label: isDeveloper ? 'Mes tâches actives' : 'Tâches actives', value: data?.stats.active_tasks, suffix: isDeveloper ? ' / 3' : '' },
    { key: 'done', label: isDeveloper ? 'Mes tâches terminées' : 'Tâches terminées', value: data?.stats.done_tasks },
    { key: 'members', label: 'Membres actifs', value: data?.stats.active_members },
  ] as const

  return (
    <div className="home">
      <section className="home-hero">
        {hasImage && <img className="home-hero-image" src="/hero.jpg" alt="" onError={() => setHasImage(false)} />}
        {!hasImage && <div className="home-hero-art" aria-hidden="true" />}
        <div className="home-hero-overlay" />

        <div className="home-hero-content">
          <p className="home-eyebrow"><span className="home-eyebrow-dot" />Votre espace de travail · <span className="home-date">{today}</span></p>
          <h1>{greeting} {firstName},<br />prêt à avancer ?</h1>
          <p className="home-subtitle">{SUBTITLES[user.role]}</p>
          <div className="home-actions">
            <Link to="/projects" className="btn-primary">Voir mes projets {ICONS.arrow}</Link>
            {user.role === 'manager' && <Link to="/users" className="btn-ghost">Gérer l'équipe</Link>}
            {user.role === 'lead_dev' && <Link to={firstProject ? `/projects/${firstProject.id}` : '/projects'} className="btn-ghost">Planifier des tâches</Link>}
            {isDeveloper && <Link to="/projects" className="btn-ghost">Trouver une tâche</Link>}
          </div>
        </div>

        <div className="home-user-badge">
          <span className="home-avatar">{user.name.charAt(0).toUpperCase()}</span>
          <span><strong>{user.name}</strong><small>{ROLE_LABELS[user.role]}</small></span>
        </div>
      </section>

      <section className="home-stats">
        {stats.map((stat) => (
          <div key={stat.key} className="home-stat">
            <span className={`home-stat-icon home-stat-icon-${stat.key}`}>{ICONS[stat.key]}</span>
            <div>
              <strong>{stat.value ?? '—'}{stat.value !== undefined && 'suffix' in stat && <em>{stat.suffix}</em>}</strong>
              <span>{stat.label}</span>
            </div>
          </div>
        ))}
      </section>

      {error && <p className="error home-error">{error}</p>}

      <div className="home-grid">
        <div className="home-main">
          <section className="panel">
            <header className="panel-header">
              <div>
                <h2>{isDeveloper ? 'Mes tâches en cours' : "Tâches en cours dans l'équipe"}</h2>
                <p>Les plus urgentes d'abord, par date de démarrage.</p>
              </div>
              <Link to="/projects" className="panel-link">Tout voir {ICONS.arrow}</Link>
            </header>
            {data && data.tasks.length === 0 && (
              <div className="empty-state">
                <strong>Aucune tâche en cours</strong>
                <span>{isDeveloper ? 'Prenez une tâche disponible ou attendez une assignation de votre Lead développeur.' : 'Les tâches assignées ou démarrées apparaîtront ici.'}</span>
              </div>
            )}
            <ul className="task-rows">
              {data?.tasks.map((task) => (
                <li key={task.id}>
                  <Link to={`/projects/${task.project_id}`} className="task-row">
                    <span className={`status-dot status-${task.status}`} />
                    <span className="task-row-main">
                      <strong>{task.title}</strong>
                      <small>{task.project_name}{!isDeveloper && task.assignee && ` · ${task.assignee.name}`}</small>
                    </span>
                    {isLate(task) && <span className="tag tag-late">À démarrer</span>}
                    <span className={`tag tag-${task.status}`}>{STATUS_LABELS[task.status]}</span>
                    <span className="task-row-date">{formatDay(task.start_date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <header className="panel-header">
              <div>
                <h2>Avancement des projets</h2>
                <p>Part des tâches terminées par projet.</p>
              </div>
              <Link to="/projects" className="panel-link">Tous les projets {ICONS.arrow}</Link>
            </header>
            {data && data.projects.length === 0 && (
              <div className="empty-state">
                <strong>Aucun projet pour l'instant</strong>
                <span>{user.role === 'manager' ? 'Créez votre premier projet et choisissez son Lead développeur.' : 'Vous verrez ici les projets auxquels vous participez.'}</span>
              </div>
            )}
            <ul className="project-rows">
              {data?.projects.map((project) => {
                const percent = project.total ? Math.round((project.done / project.total) * 100) : 0
                return (
                  <li key={project.id}>
                    <Link to={`/projects/${project.id}`} className="project-row">
                      <span className="project-initial">{project.name.charAt(0).toUpperCase()}</span>
                      <span className="project-row-main">
                        <strong>{project.name}</strong>
                        <small>Lead : {project.lead_dev} · {project.members} développeur(s) · {project.active} tâche(s) active(s)</small>
                        <span className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                          <span style={{ width: `${percent}%` }} />
                        </span>
                      </span>
                      <span className="project-row-percent">{percent}%<small>{project.done}/{project.total}</small></span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <aside className="home-side">
          <section className="panel">
            <header className="panel-header"><h2>Actions rapides</h2></header>
            <div className="quick-actions">
              {user.role === 'manager' && (
                <>
                  <QuickAction to="/projects" icon={ICONS.plus} title="Créer un projet" hint="Nom, Lead développeur, équipe" />
                  <QuickAction to="/users" icon={ICONS.userPlus} title="Ajouter un utilisateur" hint="Rôle et projets" />
                  <QuickAction to="/users" icon={ICONS.shield} title="Gérer les accès" hint="Activer ou désactiver un compte" />
                </>
              )}
              {user.role === 'lead_dev' && (
                <>
                  <QuickAction to={firstProject ? `/projects/${firstProject.id}` : '/projects'} icon={ICONS.plus} title="Créer une tâche" hint={firstProject ? firstProject.name : 'Choisissez un projet'} />
                  <QuickAction to="/projects" icon={ICONS.folder} title="Mes projets" hint="Assigner et suivre les tâches" />
                </>
              )}
              {isDeveloper && (
                <>
                  <QuickAction to="/projects" icon={ICONS.hand} title="Prendre une tâche" hint={`${data?.free_tasks ?? 0} tâche(s) disponible(s)`} />
                  <QuickAction to="/projects" icon={ICONS.folder} title="Mes projets" hint="Démarrer et terminer mes tâches" />
                </>
              )}
              <QuickAction to="/change-password" icon={ICONS.key} title="Mot de passe" hint="Sécuriser mon compte" />
            </div>
          </section>

          {!isDeveloper && data && data.free_tasks > 0 && (
            <section className="panel panel-highlight">
              <strong>{data.free_tasks} tâche(s) non assignée(s)</strong>
              <span>{user.role === 'lead_dev' ? 'Assignez-les à un développeur de votre équipe.' : 'En attente d’assignation par les Leads développeurs.'}</span>
            </section>
          )}

          <section className="panel">
            <header className="panel-header"><h2>Règles de l'équipe</h2></header>
            <ul className="rules">
              <li><span>3</span>tâches actives au maximum par développeur</li>
              <li><span>1 j</span>pour démarrer une tâche après sa date prévue, sinon elle est libérée</li>
              <li><span>3 j</span>après sa création, une tâche libre peut être prise par un développeur du projet</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

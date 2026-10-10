import 'dotenv/config'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import cron from 'node-cron'
import { PrismaClient, Role, TaskStatus, type User } from '@prisma/client'

const prisma = new PrismaClient()
const app = express()
const port = Number(process.env.PORT || 8000)
const secret = process.env.JWT_SECRET || 'development-secret-change-me'
const DAY = 86400000
const MAX_ACTIVE_TASKS = 3
type AuthRequest = Request & { user?: User }
type AsyncRoute = (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>
const asyncRoute = (handler: AsyncRoute) => (req: Request, res: Response, next: NextFunction) => void handler(req as AuthRequest, res, next).catch(next)

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

const publicUser = (user: User) => ({ id: user.id, name: user.name, email: user.email, role: user.role, github_username: user.githubUsername, is_active: user.isActive, must_change_password: user.mustChangePassword })
const projectData = (project: any) => ({ id: project.id, name: project.name, description: project.description, manager_id: project.managerId, lead_dev_id: project.leadDevId, github_repo: project.githubRepo, github_default_branch: project.githubDefaultBranch, manager: project.manager && publicUser(project.manager), lead_dev: project.leadDev && publicUser(project.leadDev), members: (project.members ?? []).map(publicUser) })
const taskData = (task: any) => ({ id: task.id, project_id: task.projectId, title: task.title, description: task.description, status: task.status, assigned_to: task.assignedTo, start_date: task.startDate.toISOString().slice(0, 10), created_at: task.createdAt, available_at: new Date(task.createdAt.getTime() + 3 * DAY), assigned_at: task.assignedAt, started_at: task.startedAt, completed_at: task.completedAt, github_branch: task.githubBranch, assignee: task.assignee && publicUser(task.assignee) })
const fail = (res: Response, status: number, message: string) => res.status(status).json({ message })
// Le rôle manager existe uniquement via le seeder : il n'est jamais assignable
const isAssignableRole = (value: unknown): value is Role => value === Role.lead_dev || value === Role.developer
const isRole = (value: unknown): value is Role => Object.values(Role).includes(value as Role)
const toIds = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(Number).filter(Number.isInteger))] : []

// Évite qu'un identifiant absent ou invalide (NaN) ne fasse planter Prisma
const findUser = async (id: unknown) => Number.isInteger(Number(id)) ? prisma.user.findUnique({ where: { id: Number(id) } }) : null
const projectInclude = { manager: true, leadDev: true, members: true } as const
const activeTasks = (userId: number) => prisma.task.count({ where: { assignedTo: userId, status: { in: [TaskStatus.assigned, TaskStatus.in_progress] } } })
const getProject = async (id: unknown) => Number.isInteger(Number(id)) ? prisma.project.findUnique({ where: { id: Number(id) }, include: projectInclude }) : null
const getTask = async (id: unknown) => !Number.isInteger(Number(id)) ? null : prisma.task.findUnique({ where: { id: Number(id) }, include: { project: { include: { members: true } }, assignee: true } })
type FullProject = NonNullable<Awaited<ReturnType<typeof getProject>>>
const isMember = (project: { members: User[] }, userId: number) => project.members.some((member) => member.id === userId)
const canSeeProject = (user: User, project: FullProject) => user.role === Role.manager ? project.managerId === user.id : user.role === Role.lead_dev ? project.leadDevId === user.id : isMember(project, user.id)
const visibleProjects = (user: User) => user.role === Role.manager ? { managerId: user.id } : user.role === Role.lead_dev ? { leadDevId: user.id } : { members: { some: { id: user.id } } }
const unassign = { assignedTo: null, status: TaskStatus.predefined, assignedAt: null, startedAt: null }

// Un développeur perd sa tâche s'il ne l'a pas démarrée 1 jour après la date prévue (ou après sa réassignation si elle est plus récente)
const releaseDeadline = (task: { startDate: Date; assignedAt: Date | null }) => Math.max(task.startDate.getTime(), task.assignedAt?.getTime() ?? 0) + DAY
async function releaseOverdueTasks() {
  const pending = await prisma.task.findMany({ where: { status: TaskStatus.assigned, startedAt: null }, select: { id: true, startDate: true, assignedAt: true } })
  const overdue = pending.filter((task) => releaseDeadline(task) <= Date.now()).map((task) => task.id)
  if (overdue.length) await prisma.task.updateMany({ where: { id: { in: overdue } }, data: unassign })
}
// Les membres retirés d'un projet ou désactivés libèrent leurs tâches non terminées
const releaseTasksOf = (userIds: number[], projectId?: number) => prisma.task.updateMany({ where: { assignedTo: { in: userIds }, projectId, status: { in: [TaskStatus.assigned, TaskStatus.in_progress] } }, data: unassign })
async function validDevelopers(ids: number[]) {
  const developers = await prisma.user.findMany({ where: { id: { in: ids }, role: Role.developer, isActive: true } })
  return developers.length === ids.length
}

const authenticate = asyncRoute(async (req, res, next) => {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return fail(res, 401, 'Non authentifié.')
  try {
    const { id } = jwt.verify(token, secret) as { id: number }
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return fail(res, 401, 'Session invalide.')
    if (!user.isActive) return fail(res, 401, 'Votre compte a été désactivé.')
    req.user = user
    next()
  } catch { return fail(res, 401, 'Session invalide.') }
})
const requireRole = (...roles: Role[]) => (req: AuthRequest, res: Response, next: NextFunction) => !req.user || !roles.includes(req.user.role) ? fail(res, 403, 'Accès non autorisé.') : next()
const passwordChangeRoutes = ['/me', '/logout', '/change-password']
const requirePasswordChanged = (req: AuthRequest, res: Response, next: NextFunction) => req.user!.mustChangePassword && !passwordChangeRoutes.includes(req.path) ? fail(res, 403, 'Vous devez changer votre mot de passe avant de continuer.') : next()

app.post('/api/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) return fail(res, 422, 'Email et mot de passe requis.')
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !await bcrypt.compare(password, user.password)) return fail(res, 422, 'Identifiants invalides.')
  if (!user.isActive) return fail(res, 403, 'Votre compte a été désactivé. Contactez votre manager.')
  const token = jwt.sign({ id: user.id }, secret, { expiresIn: '7d' })
  res.json({ user: publicUser(user), token })
}))

app.use('/api', authenticate, requirePasswordChanged)
app.post('/api/logout', (_req, res) => res.json({ message: 'Déconnecté.' }))
app.get('/api/me', (req: AuthRequest, res) => res.json(publicUser(req.user!)))
app.post('/api/change-password', asyncRoute(async (req, res) => {
  const { current_password, new_password } = req.body
  if (!current_password || !new_password || String(new_password).length < 8) return fail(res, 422, 'Le nouveau mot de passe doit contenir au moins 8 caractères.')
  if (!await bcrypt.compare(current_password, req.user!.password)) return fail(res, 422, 'Mot de passe actuel incorrect.')
  if (current_password === new_password) return fail(res, 422, 'Le nouveau mot de passe doit être différent de l’actuel.')
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { password: await bcrypt.hash(new_password, 12), mustChangePassword: false } })
  res.json(publicUser(user))
}))

app.get('/api/users', requireRole(Role.manager), asyncRoute(async (req, res) => {
  const role = req.query.role
  const users = await prisma.user.findMany({ where: isRole(role) ? { role } : {}, include: { memberProjects: { select: { id: true } } }, orderBy: { name: 'asc' } })
  res.json(users.map((user) => ({ ...publicUser(user), project_ids: user.memberProjects.map((project) => project.id) })))
}))
app.get('/api/users/:id', requireRole(Role.manager), asyncRoute(async (req, res) => { const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } }); return user ? res.json(publicUser(user)) : fail(res, 404, 'Utilisateur introuvable.') }))
app.post('/api/users', requireRole(Role.manager), asyncRoute(async (req, res) => {
  const { name, email, password, role, github_username } = req.body
  if (!isAssignableRole(role)) return fail(res, 422, 'Rôle invalide : seuls Lead développeur et Développeur peuvent être attribués.')
  if (!name || !email || !password || password.length < 8) return fail(res, 422, 'Nom, email et mot de passe (8 caractères minimum) requis.')
  if (await prisma.user.findUnique({ where: { email } })) return fail(res, 422, 'Cet email est déjà utilisé.')
  const projectIds = role === Role.developer ? toIds(req.body.project_ids) : []
  if (await prisma.project.count({ where: { id: { in: projectIds }, managerId: req.user!.id } }) !== projectIds.length) return fail(res, 422, 'Projet invalide.')
  const user = await prisma.user.create({ data: { name, email, password: await bcrypt.hash(password, 12), role, githubUsername: github_username || null, memberProjects: { connect: projectIds.map((id) => ({ id })) } } })
  res.status(201).json({ ...publicUser(user), project_ids: projectIds })
}))
app.put('/api/users/:id', requireRole(Role.manager), asyncRoute(async (req, res) => {
  const id = Number(req.params.id); const current = await prisma.user.findUnique({ where: { id }, include: { leadProjects: { select: { id: true } } } }); if (!current) return fail(res, 404, 'Utilisateur introuvable.')
  const { name, email, password, github_username } = req.body
  const role = req.body.role ?? current.role
  if (role !== current.role && (current.role === Role.manager || !isAssignableRole(role))) return fail(res, 422, 'Le rôle Manager n’est pas assignable.')
  if (role !== current.role && current.leadProjects.length) return fail(res, 422, 'Cet utilisateur est Lead développeur d’un projet : changez d’abord le Lead de ce projet.')
  if (password && password.length < 8) return fail(res, 422, 'Le mot de passe doit contenir au moins 8 caractères.')
  if (email && email !== current.email && await prisma.user.findUnique({ where: { email } })) return fail(res, 422, 'Cet email est déjà utilisé.')
  const projectIds = role === Role.developer && req.body.project_ids !== undefined ? toIds(req.body.project_ids) : role === Role.developer ? undefined : []
  if (projectIds && await prisma.project.count({ where: { id: { in: projectIds }, managerId: req.user!.id } }) !== projectIds.length) return fail(res, 422, 'Projet invalide.')
  if (role !== current.role) await releaseTasksOf([id])
  if (projectIds) {
    const removed = await prisma.project.findMany({ where: { members: { some: { id } }, id: { notIn: projectIds } }, select: { id: true } })
    for (const project of removed) await releaseTasksOf([id], project.id)
  }
  const user = await prisma.user.update({ where: { id }, data: { name: name ?? undefined, email: email ?? undefined, role, githubUsername: github_username ?? undefined, password: password ? await bcrypt.hash(password, 12) : undefined, memberProjects: projectIds && { set: projectIds.map((projectId) => ({ id: projectId })) } }, include: { memberProjects: { select: { id: true } } } })
  res.json({ ...publicUser(user), project_ids: user.memberProjects.map((project) => project.id) })
}))
app.patch('/api/users/:id/status', requireRole(Role.manager), asyncRoute(async (req, res) => {
  const id = Number(req.params.id); const current = await prisma.user.findUnique({ where: { id } }); if (!current) return fail(res, 404, 'Utilisateur introuvable.')
  if (current.role === Role.manager) return fail(res, 422, 'Le compte manager ne peut pas être désactivé.')
  const isActive = Boolean(req.body.is_active)
  if (!isActive) await releaseTasksOf([id])
  const user = await prisma.user.update({ where: { id }, data: { isActive } })
  res.json(publicUser(user))
}))
app.delete('/api/users/:id', requireRole(Role.manager), asyncRoute(async (req, res) => {
  const id = Number(req.params.id); const current = await prisma.user.findUnique({ where: { id }, include: { leadProjects: { select: { id: true } } } }); if (!current) return fail(res, 404, 'Utilisateur introuvable.')
  if (current.role === Role.manager) return fail(res, 422, 'Le compte manager ne peut pas être supprimé.')
  if (current.leadProjects.length) return fail(res, 422, 'Cet utilisateur est Lead développeur d’un projet : changez d’abord le Lead de ce projet.')
  await releaseTasksOf([id]); await prisma.user.delete({ where: { id } }); res.json({ message: 'Utilisateur supprimé.' })
}))

app.get('/api/projects', asyncRoute(async (req, res) => {
  const projects = await prisma.project.findMany({ where: visibleProjects(req.user!), include: projectInclude, orderBy: { id: 'desc' } }); res.json(projects.map(projectData))
}))
// Tableau de bord de la page d'accueil, limité à ce que l'utilisateur connecté peut voir
app.get('/api/dashboard', asyncRoute(async (req, res) => {
  const user = req.user!
  await releaseOverdueTasks()
  const active: TaskStatus[] = [TaskStatus.assigned, TaskStatus.in_progress]
  const projects = await prisma.project.findMany({ where: visibleProjects(user), include: { leadDev: true, members: true, tasks: { select: { status: true } } }, orderBy: { updatedAt: 'desc' } })
  const projectIds = projects.map((project) => project.id)
  const taskScope = user.role === Role.developer ? { assignedTo: user.id } : { projectId: { in: projectIds } }
  const activeMembers = new Set(projects.flatMap((project) => [project.leadDev, ...project.members]).filter((member) => member.isActive).map((member) => member.id))
  // Tâches à suivre : celles du développeur, ou celles en cours de l'équipe pour le lead et le manager, les plus urgentes d'abord
  const focusTasks = await prisma.task.findMany({ where: { ...taskScope, status: { in: active } }, include: { assignee: true, project: { select: { name: true } } }, orderBy: { startDate: 'asc' }, take: 6 })
  const freeTasks = { projectId: { in: projectIds }, status: TaskStatus.predefined, assignedTo: null }
  res.json({
    stats: {
      projects: projects.length,
      active_tasks: await prisma.task.count({ where: { ...taskScope, status: { in: active } } }),
      done_tasks: await prisma.task.count({ where: { ...taskScope, status: TaskStatus.done } }),
      active_members: user.role === Role.manager ? await prisma.user.count({ where: { isActive: true, role: { not: Role.manager } } }) : activeMembers.size,
    },
    free_tasks: await prisma.task.count({ where: user.role === Role.developer ? { ...freeTasks, createdAt: { lte: new Date(Date.now() - 3 * DAY) } } : freeTasks }),
    projects: projects.slice(0, 5).map((project) => ({
      id: project.id, name: project.name, lead_dev: project.leadDev.name, members: project.members.length,
      total: project.tasks.length, done: project.tasks.filter((task) => task.status === TaskStatus.done).length,
      active: project.tasks.filter((task) => active.includes(task.status)).length,
    })),
    tasks: focusTasks.map((task) => ({ ...taskData(task), project_name: task.project.name })),
  })
}))
app.get('/api/projects/:id', asyncRoute(async (req, res) => { const project = await getProject(req.params.id); return project && canSeeProject(req.user!, project) ? res.json(projectData(project)) : fail(res, 404, 'Projet introuvable.') }))
app.post('/api/projects', requireRole(Role.manager), asyncRoute(async (req, res) => {
  const { name, description, lead_dev_id, github_repo, github_default_branch } = req.body; const leadId = Number(lead_dev_id); const lead = await findUser(lead_dev_id)
  if (!name) return fail(res, 422, 'Le nom du projet est requis.')
  if (!lead || lead.role !== Role.lead_dev || !lead.isActive) return fail(res, 422, 'Un Lead développeur actif est obligatoire.')
  const memberIds = toIds(req.body.member_ids); if (!await validDevelopers(memberIds)) return fail(res, 422, 'Les membres doivent être des développeurs actifs.')
  const project = await prisma.project.create({ data: { name, description: description || null, managerId: req.user!.id, leadDevId: leadId, githubRepo: github_repo || null, githubDefaultBranch: github_default_branch || 'main', members: { connect: memberIds.map((id) => ({ id })) } }, include: projectInclude })
  res.status(201).json(projectData(project))
}))
app.put('/api/projects/:id', requireRole(Role.manager), asyncRoute(async (req, res) => {
  const current = await getProject(req.params.id); if (!current || current.managerId !== req.user!.id) return fail(res, 404, 'Projet introuvable.')
  if (req.body.lead_dev_id !== undefined) { const lead = await findUser(req.body.lead_dev_id); if (!lead || lead.role !== Role.lead_dev || !lead.isActive) return fail(res, 422, 'Un Lead développeur actif est obligatoire.') }
  const memberIds = req.body.member_ids !== undefined ? toIds(req.body.member_ids) : undefined
  if (memberIds) {
    const removed = current.members.filter((member) => !memberIds.includes(member.id)).map((member) => member.id)
    const added = memberIds.filter((id) => !isMember(current, id))
    if (!await validDevelopers(added)) return fail(res, 422, 'Les membres doivent être des développeurs actifs.')
    await releaseTasksOf(removed, current.id)
  }
  const project = await prisma.project.update({ where: { id: current.id }, data: { name: req.body.name, description: req.body.description, leadDevId: req.body.lead_dev_id ? Number(req.body.lead_dev_id) : undefined, githubRepo: req.body.github_repo, githubDefaultBranch: req.body.github_default_branch, members: memberIds && { set: memberIds.map((id) => ({ id })) } }, include: projectInclude })
  res.json(projectData(project))
}))
app.delete('/api/projects/:id', requireRole(Role.manager), asyncRoute(async (req, res) => { const current = await getProject(req.params.id); if (!current || current.managerId !== req.user!.id) return fail(res, 404, 'Projet introuvable.'); await prisma.project.delete({ where: { id: current.id } }); res.json({ message: 'Projet supprimé.' }) }))

app.get('/api/projects/:id/tasks', asyncRoute(async (req, res) => {
  const project = await getProject(req.params.id); if (!project || !canSeeProject(req.user!, project)) return fail(res, 404, 'Projet introuvable.')
  await releaseOverdueTasks()
  const tasks = await prisma.task.findMany({ where: { projectId: project.id }, include: { assignee: true }, orderBy: { id: 'desc' } }); res.json(tasks.map(taskData))
}))
app.post('/api/projects/:id/tasks', requireRole(Role.lead_dev), asyncRoute(async (req, res) => {
  const project = await getProject(req.params.id); const { title, description, start_date } = req.body
  if (!project) return fail(res, 404, 'Projet introuvable.')
  if (project.leadDevId !== req.user!.id) return fail(res, 403, 'Seul le Lead développeur du projet peut créer des tâches.')
  if (!title || !start_date || Number.isNaN(new Date(start_date).getTime())) return fail(res, 422, 'Titre et date de démarrage valides requis.')
  const task = await prisma.task.create({ data: { projectId: project.id, title, description: description || null, startDate: new Date(start_date), status: TaskStatus.predefined } }); res.status(201).json(taskData(task))
}))

app.post('/api/tasks/:id/assign', requireRole(Role.lead_dev), asyncRoute(async (req, res) => {
  const task = await getTask(req.params.id); const developer = await findUser(req.body.developer_id)
  if (!task || !developer) return fail(res, 404, 'Tâche ou développeur introuvable.')
  if (task.project.leadDevId !== req.user!.id) return fail(res, 403, 'Seul le Lead développeur du projet peut assigner une tâche.')
  if (developer.role !== Role.developer || !developer.isActive || !isMember(task.project, developer.id)) return fail(res, 422, 'Le développeur doit être actif et membre du projet.')
  if (task.status !== TaskStatus.predefined) return fail(res, 422, 'Seule une tâche non assignée peut être assignée.')
  if (await activeTasks(developer.id) >= MAX_ACTIVE_TASKS) return fail(res, 422, `${developer.name} a déjà ${MAX_ACTIVE_TASKS} tâches en cours.`)
  const updated = await prisma.task.update({ where: { id: task.id }, data: { assignedTo: developer.id, status: TaskStatus.assigned, assignedAt: new Date(), startedAt: null }, include: { assignee: true } }); res.json(taskData(updated))
}))
app.post('/api/tasks/:id/take', requireRole(Role.developer), asyncRoute(async (req, res) => {
  const task = await getTask(req.params.id); if (!task || !isMember(task.project, req.user!.id)) return fail(res, 404, 'Tâche introuvable.')
  if (task.assignedTo || task.status !== TaskStatus.predefined) return fail(res, 422, 'Cette tâche est déjà prise.')
  if (Date.now() - task.createdAt.getTime() < 3 * DAY) return fail(res, 422, 'Une tâche ne peut être prise que 3 jours après sa création.')
  if (await activeTasks(req.user!.id) >= MAX_ACTIVE_TASKS) return fail(res, 422, `Vous avez déjà ${MAX_ACTIVE_TASKS} tâches en cours.`)
  const updated = await prisma.task.update({ where: { id: task.id }, data: { assignedTo: req.user!.id, status: TaskStatus.assigned, assignedAt: new Date() }, include: { assignee: true } }); res.json(taskData(updated))
}))
app.post('/api/tasks/:id/start', requireRole(Role.developer), asyncRoute(async (req, res) => {
  await releaseOverdueTasks()
  const task = await getTask(req.params.id); if (!task || task.assignedTo !== req.user!.id) return fail(res, 403, 'Cette tâche ne vous est pas (ou plus) assignée.')
  if (task.status !== TaskStatus.assigned) return fail(res, 422, 'Transition invalide.')
  const updated = await prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.in_progress, startedAt: new Date() } }); res.json(taskData(updated))
}))
app.post('/api/tasks/:id/complete', requireRole(Role.developer), asyncRoute(async (req, res) => { const task = await getTask(req.params.id); if (!task || task.assignedTo !== req.user!.id) return fail(res, 403, 'Cette tâche ne vous est pas assignée.'); if (task.status !== TaskStatus.in_progress) return fail(res, 422, 'Transition invalide.'); const updated = await prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.done, completedAt: new Date() } }); res.json(taskData(updated)) }))
app.post('/api/tasks/:id/release', requireRole(Role.lead_dev), asyncRoute(async (req, res) => { const task = await getTask(req.params.id); if (!task || task.project.leadDevId !== req.user!.id) return fail(res, 403, 'Accès non autorisé.'); if (task.status !== TaskStatus.assigned || task.startedAt || releaseDeadline(task) > Date.now()) return fail(res, 422, 'Cette tâche n’est pas éligible à la libération.'); const updated = await prisma.task.update({ where: { id: task.id }, data: unassign }); res.json(taskData(updated)) }))

app.post('/api/tasks/:id/github-branch', asyncRoute(async (req, res) => {
  const task = await getTask(req.params.id); if (!task) return fail(res, 404, 'Tâche introuvable.')
  if (task.project.leadDevId !== req.user!.id && task.assignedTo !== req.user!.id) return fail(res, 403, 'Seuls le Lead développeur du projet et le développeur assigné peuvent créer une branche.')
  if (!task.project.githubRepo) return fail(res, 422, 'Aucun dépôt GitHub n’est configuré pour ce projet.')
  if (task.githubBranch) return res.json({ branch: task.githubBranch, repo: task.project.githubRepo, url: `https://github.com/${task.project.githubRepo}/tree/${task.githubBranch}` })
  const token = process.env.GITHUB_TOKEN; if (!token) return fail(res, 500, 'Aucun jeton GitHub n’est configuré côté serveur.')
  const branch = `task-${task.id}-${task.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`; const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; const base = task.project.githubDefaultBranch || 'main'
  const ref = await fetch(`https://api.github.com/repos/${task.project.githubRepo}/git/ref/heads/${base}`, { headers }); if (!ref.ok) return fail(res, 502, `Impossible de lire la branche de base '${base}' sur GitHub.`)
  const sha = (await ref.json() as { object: { sha: string } }).object.sha
  const create = await fetch(`https://api.github.com/repos/${task.project.githubRepo}/git/refs`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }) }); if (!create.ok) return fail(res, 502, 'Échec de la création de la branche sur GitHub.')
  await prisma.task.update({ where: { id: task.id }, data: { githubBranch: branch } }); res.json({ branch, repo: task.project.githubRepo, url: `https://github.com/${task.project.githubRepo}/tree/${branch}` })
}))

cron.schedule('0 * * * *', () => { void releaseOverdueTasks().catch(console.error) })
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => { console.error(error); res.status(500).json({ message: 'Erreur interne du serveur.' }) })
app.listen(port, () => console.log(`API TypeScript disponible sur http://localhost:${port}/api`))

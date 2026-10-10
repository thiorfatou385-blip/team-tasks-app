export type UserRole = 'manager' | 'lead_dev' | 'developer'
export type TaskStatus = 'predefined' | 'assigned' | 'in_progress' | 'done'

export interface User { id: number; name: string; email: string; role: UserRole; github_username?: string | null; is_active: boolean; must_change_password: boolean; project_ids?: number[] }
export interface Project { id: number; name: string; description?: string | null; manager_id: number; lead_dev_id: number; github_repo?: string | null; github_default_branch?: string | null; manager?: User; lead_dev?: User; members: User[] }
export interface Task { id: number; title: string; description?: string | null; start_date: string; created_at: string; available_at: string; status: TaskStatus; assigned_to?: number | null; assignee?: User | null; github_branch?: string | null }
export interface AuthResponse { token: string; user: User }
export interface BranchInfo { url?: string }

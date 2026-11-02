import { supabase } from '../lib/supabase'

export type AdminRole = 'super_admin' | 'admin'

export interface AdminRecord {
  id: string
  user_id: string | null
  email: string
  role: AdminRole
  created_at: string
  updated_at: string
}

export async function fetchAdminList(): Promise<AdminRecord[]> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as AdminRecord[]
}

export async function addAdmin(email: string, role: AdminRole): Promise<void> {
  const cleanEmail = email.trim().toLowerCase()
  const { error } = await supabase.from('admin_users').insert([
    {
      email: cleanEmail,
      role,
    },
  ])

  if (error) throw new Error(error.message)
}

export async function updateAdminRole(id: string, role: AdminRole): Promise<void> {
  const { error } = await supabase
    .from('admin_users')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function removeAdmin(id: string): Promise<void> {
  const { error } = await supabase.from('admin_users').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

export async function fetchUserAdminRole(
  userId: string,
  email?: string,
): Promise<AdminRole | null> {
  try {
    const query = email
      ? supabase
          .from('admin_users')
          .select('role')
          .or(`user_id.eq.${userId},email.ilike.${email}`)
          .maybeSingle()
      : supabase.from('admin_users').select('role').eq('user_id', userId).maybeSingle()

    const { data, error } = await query
    if (error || !data) return null
    return (data as { role: AdminRole }).role
  } catch {
    return null
  }
}

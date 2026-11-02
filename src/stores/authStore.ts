import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchUserAdminRole, type AdminRole } from '../api/admins'

interface AuthState {
  user: User | null
  session: Session | null
  role: AdminRole | null
  isSuperAdmin: boolean
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  setSession: (session: Session | null) => Promise<void>
  setLoading: (loading: boolean) => void
  refreshRole: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  role: null,
  isSuperAdmin: false,
  isAdmin: false,
  loading: true,

  setSession: async (session) => {
    const user = session?.user ?? null
    let role: AdminRole | null = null

    if (user) {
      role = await fetchUserAdminRole(user.id, user.email)
    }

    set({
      session,
      user,
      role,
      isSuperAdmin: role === 'super_admin',
      isAdmin: role === 'admin' || role === 'super_admin',
    })
  },

  setLoading: (loading) => set({ loading }),

  refreshRole: async () => {
    const { user } = get()
    if (!user) {
      set({ role: null, isSuperAdmin: false, isAdmin: false })
      return
    }
    const role = await fetchUserAdminRole(user.id, user.email)
    set({
      role,
      isSuperAdmin: role === 'super_admin',
      isAdmin: role === 'admin' || role === 'super_admin',
    })
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    await get().refreshRole()
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({
      user: null,
      session: null,
      role: null,
      isSuperAdmin: false,
      isAdmin: false,
    })
  },
}))

export function useAuth() {
  return useAuthStore()
}

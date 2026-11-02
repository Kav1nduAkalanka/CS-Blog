import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdminList,
  addAdmin,
  updateAdminRole,
  removeAdmin,
  type AdminRole,
} from '../../api/admins'

export const ADMIN_KEYS = {
  all: ['admin_users'] as const,
  list: () => [...ADMIN_KEYS.all, 'list'] as const,
}

export function useAdminList() {
  return useQuery({
    queryKey: ADMIN_KEYS.list(),
    queryFn: fetchAdminList,
  })
}

export function useAddAdminMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: AdminRole }) => addAdmin(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.all })
    },
  })
}

export function useUpdateAdminRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) => updateAdminRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.all })
    },
  })
}

export function useRemoveAdminMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.all })
    },
  })
}

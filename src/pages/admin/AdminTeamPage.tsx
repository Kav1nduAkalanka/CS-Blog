import { useState } from 'react'
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  AlertCircle,
  Crown,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '../../stores/authStore'
import {
  useAdminList,
  useAddAdminMutation,
  useUpdateAdminRoleMutation,
  useRemoveAdminMutation,
} from '../../hooks/queries/useAdminQueries'
import { useToastStore } from '../../stores/uiStore'
import type { AdminRole } from '../../api/admins'

export function AdminTeamPage() {
  const { user, isSuperAdmin } = useAuth()
  const { data: admins = [], isLoading, error } = useAdminList()
  const addMutation = useAddAdminMutation()
  const updateRoleMutation = useUpdateAdminRoleMutation()
  const removeMutation = useRemoveAdminMutation()
  const showToast = useToastStore((s) => s.showToast)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('admin')
  const [formError, setFormError] = useState('')

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Please enter a valid email address.')
      return
    }

    if (admins.some((a) => a.email.toLowerCase() === cleanEmail)) {
      setFormError('This email is already an assigned administrator.')
      return
    }

    try {
      await addMutation.mutateAsync({ email: cleanEmail, role })
      showToast(`Added ${cleanEmail} as ${role === 'super_admin' ? 'Super Admin' : 'Admin'}.`, 'success')
      setEmail('')
      setRole('admin')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add administrator.'
      setFormError(msg)
      showToast('Failed to assign admin.', 'error')
    }
  }

  const handleRoleChange = async (id: string, currentEmail: string, newRole: AdminRole) => {
    if (currentEmail.toLowerCase() === user?.email?.toLowerCase()) {
      if (!window.confirm('Are you sure you want to change your own role?')) return
    }

    try {
      await updateRoleMutation.mutateAsync({ id, role: newRole })
      showToast(`Updated role to ${newRole === 'super_admin' ? 'Super Admin' : 'Admin'}.`, 'success')
    } catch {
      showToast('Failed to update role.', 'error')
    }
  }

  const handleRemove = async (id: string, targetEmail: string) => {
    if (targetEmail.toLowerCase() === user?.email?.toLowerCase()) {
      alert('You cannot remove your own administrator account while logged in.')
      return
    }

    if (!window.confirm(`Are you sure you want to remove ${targetEmail} from the admin team?`)) {
      return
    }

    try {
      await removeMutation.mutateAsync(id)
      showToast(`Removed ${targetEmail} from the admin team.`, 'success')
    } catch {
      showToast('Failed to remove admin.', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-brand/10 text-brand flex size-10 items-center justify-center rounded-xl font-bold">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-navy text-[28px] font-extrabold">Admin Team Management</h1>
            <p className="text-[14px] text-[#6b7280]">
              Control who can access the dashboard, edit blog articles, review student stories, and manage settings.
            </p>
          </div>
        </div>
      </div>

      {/* Permission alert for regular admins */}
      {!isSuperAdmin && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-amber-900">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="text-[13.5px]">
            <p className="font-semibold">View-Only Access</p>
            <p className="mt-0.5 text-amber-800">
              You are signed in with an <strong>Admin</strong> account. Only users with the{' '}
              <strong>Super Admin</strong> role have permission to add, edit, or revoke administrator accounts.
            </p>
          </div>
        </div>
      )}

      {/* Super Admin Add Card */}
      {isSuperAdmin && (
        <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex items-center gap-2">
            <UserPlus size={18} className="text-brand" />
            <h2 className="text-navy text-[17px] font-bold">Assign New Administrator</h2>
          </div>

          <form onSubmit={handleAddAdmin} className="flex flex-col gap-4">
            {formError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <p>{formError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <label className="text-navy mb-1.5 block text-[13px] font-semibold">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. colleague@aiesec.net"
                  className="focus:border-brand focus:ring-brand/20 text-navy h-[44px] w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 text-[14px] placeholder:text-[#9ca3af] focus:ring-2 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-navy mb-1.5 block text-[13px] font-semibold">
                  Role Permission
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AdminRole)}
                  className="focus:border-brand focus:ring-brand/20 text-navy h-[44px] w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 text-[14px] focus:ring-2 focus:outline-none"
                >
                  <option value="admin">Admin (Manage Posts &amp; Messages)</option>
                  <option value="super_admin">Super Admin (Full Access + Assign Admins)</option>
                </select>
              </div>

              <div className="flex items-end sm:col-span-2">
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="bg-brand hover:bg-brand-dark flex h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-bold text-white shadow-sm transition-colors disabled:opacity-60"
                >
                  {addMutation.isPending ? 'Adding…' : 'Add Admin'}
                </button>
              </div>
            </div>

            <p className="text-[12px] text-[#9ca3af]">
              Note: Once added, they can sign in or create an account at <code className="text-navy">/admin</code> using this email.
            </p>
          </form>
        </div>
      )}

      {/* Admin List Card */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <h2 className="text-navy text-[17px] font-bold">Current Administrators</h2>
          <p className="text-[13px] text-[#6b7280]">
            {admins.length} {admins.length === 1 ? 'account' : 'accounts'} with dashboard access
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <span className="size-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            <AlertCircle size={24} className="mx-auto mb-2 text-red-500" />
            <p className="text-[14px]">Failed to load admin list.</p>
          </div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-[15px] font-medium">No administrators found in database.</p>
            <p className="mt-1 text-[13px]">
              Run the bootstrap SQL snippet to assign your initial Super Admin account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-slate-50 text-[12px] font-bold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3 sm:px-8">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Date Added</th>
                  {isSuperAdmin && <th className="px-6 py-3 text-right sm:px-8">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admins.map((adm) => {
                  const isCurrent = adm.email.toLowerCase() === user?.email?.toLowerCase()
                  const isLinked = !!adm.user_id

                  return (
                    <tr key={adm.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-6 py-4 sm:px-8">
                        <div className="flex items-center gap-2">
                          <span className="text-navy font-semibold">{adm.email}</span>
                          {isCurrent && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                              You
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {isSuperAdmin && !isCurrent ? (
                          <select
                            value={adm.role}
                            onChange={(e) =>
                              handleRoleChange(adm.id, adm.email, e.target.value as AdminRole)
                            }
                            className="h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] font-medium text-slate-700 focus:outline-none"
                          >
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                          </select>
                        ) : adm.role === 'super_admin' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-[12px] font-bold text-purple-700">
                            <Crown size={13} className="text-purple-600" />
                            Super Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[12px] font-bold text-blue-700">
                            <ShieldCheck size={13} className="text-blue-600" />
                            Admin
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isLinked ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-green-700">
                            <CheckCircle2 size={14} className="text-green-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-amber-700">
                            <Clock size={14} className="text-amber-500" />
                            Awaiting Login
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-[13px] text-slate-500">
                        {new Date(adm.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {isSuperAdmin && (
                        <td className="px-6 py-4 text-right sm:px-8">
                          {!isCurrent ? (
                            <button
                              type="button"
                              onClick={() => handleRemove(adm.id, adm.email)}
                              disabled={removeMutation.isPending}
                              title="Revoke Admin Access"
                              className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : (
                            <span className="text-[12px] text-slate-400 italic">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

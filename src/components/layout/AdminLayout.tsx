import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, PenLine, LogOut, ExternalLink, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../stores/authStore'
import { images } from '../../assets/images'
import { useUnreadMessageCount } from '../../hooks/queries/useContactMessageQueries'

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'All Posts' },
  { to: '/admin/posts/new', icon: PenLine, label: 'New Post' },
  { to: '/admin/messages', icon: Mail, label: 'Messages' },
  { to: '/admin/team', icon: ShieldCheck, label: 'Admin Team' },
]

export function AdminLayout() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: unreadCount = 0 } = useUnreadMessageCount()

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin')
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-[#e5e7eb] bg-white shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-[#f0f1f5] px-6 py-5">
          <div
            className="relative size-8 shrink-0 overflow-hidden rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #0a6fd4 0%, #037ef3 50%, #38a5ff 100%)',
              boxShadow: '0 2px 8px rgba(3,126,243,0.30)',
            }}
          >
            <span
              className="pointer-events-none absolute -top-1 -right-1 size-3/4 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), transparent 70%)',
              }}
            />
            <img
              src={images.logo}
              alt="AIESEC in Colombo South"
              className="absolute inset-0 size-full object-contain p-[8%]"
            />
          </div>
          <div>
            <p className="text-navy text-[12px] font-extrabold tracking-[0.96px]">AIESEC</p>
            <p className="text-brand text-[9px] font-medium tracking-[0.36px]">IN COLOMBO SOUTH</p>
          </div>
        </div>

        {/* Label */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-[10px] font-semibold tracking-[1.2px] text-[#9ca3af] uppercase">
            Admin Panel
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors',
                  isActive
                    ? 'bg-brand/10 text-brand'
                    : 'hover:text-navy text-[#6b7280] hover:bg-[#f5f7fa]',
                ].join(' ')
              }
            >
              <Icon size={18} />
              {label}
              {to === '/admin/messages' && unreadCount > 0 && (
                <span className="bg-brand ml-auto flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-[#f0f1f5] p-4">
          <a
            href="/blog"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-navy mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-[#6b7280] transition-colors hover:bg-[#f5f7fa]"
          >
            <ExternalLink size={15} />
            View Blog
          </a>
          <div className="mb-2 rounded-lg bg-[#f5f7fa] px-3 py-2">
            <p className="text-navy truncate text-[12px] font-semibold">{user?.email}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              {role === 'super_admin' ? (
                <span className="font-bold text-purple-600">Super Admin</span>
              ) : (
                <span className="font-bold text-blue-600">Admin</span>
              )}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-[#ef4444] transition-colors hover:bg-red-50"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-[240px] flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}

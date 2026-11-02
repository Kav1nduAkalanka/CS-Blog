import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '../components/layout/RootLayout'
import { AdminLayout } from '../components/layout/AdminLayout'
import { ProtectedRoute } from '../components/admin/ProtectedRoute'
import { HomePage } from '../pages/HomePage'
import { AboutPage } from '../pages/AboutPage'
import { BlogPage } from '../pages/BlogPage'
import { BlogArticlePage } from '../pages/BlogArticlePage'
import { BlogSubmissionPage } from '../pages/BlogSubmissionPage'
import { GlobalVolunteerPage } from '../pages/GlobalVolunteerPage'
import { GlobalTalentPage } from '../pages/GlobalTalentPage'
import { GlobalTeacherPage } from '../pages/GlobalTeacherPage'
import { ContactPage } from '../pages/ContactPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { AdminPostEditorPage } from '../pages/admin/AdminPostEditorPage'
import { AdminMessagesPage } from '../pages/admin/AdminMessagesPage'
import { AdminMessageDetailPage } from '../pages/admin/AdminMessageDetailPage'
import { AdminTeamPage } from '../pages/admin/AdminTeamPage'

export const router = createBrowserRouter([
  // ── Public website (with Navbar + Footer) ──────────────────────────────
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/blog', element: <BlogPage /> },
      { path: '/blog/submit', element: <BlogSubmissionPage /> },
      { path: '/submit-story', element: <BlogSubmissionPage /> },
      { path: '/blog/:id', element: <BlogArticlePage /> },
      { path: '/programs/global-volunteer', element: <GlobalVolunteerPage /> },
      { path: '/programs/global-talent', element: <GlobalTalentPage /> },
      { path: '/programs/global-teacher', element: <GlobalTeacherPage /> },
      { path: '/contact', element: <ContactPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // ── Admin login (no layout wrapper) ───────────────────────────────────
  { path: '/admin', element: <AdminLoginPage /> },

  // ── Admin panel (sidebar layout, protected) ───────────────────────────
  {
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/admin/dashboard', element: <AdminDashboardPage /> },
      { path: '/admin/posts/new', element: <AdminPostEditorPage /> },
      { path: '/admin/posts/:id/edit', element: <AdminPostEditorPage /> },
      { path: '/admin/messages', element: <AdminMessagesPage /> },
      { path: '/admin/messages/:id', element: <AdminMessageDetailPage /> },
      { path: '/admin/team', element: <AdminTeamPage /> },
    ],
  },
])

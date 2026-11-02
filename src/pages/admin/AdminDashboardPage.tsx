import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PenLine, Trash2, Eye, EyeOff, Plus, FileText, Check } from 'lucide-react'
import { useAdminBlogPosts } from '../../hooks/queries/useBlogQueries'
import {
  useApproveBlogPost,
  useDeleteBlogPost,
  useToggleBlogPublish,
} from '../../hooks/mutations/useBlogMutations'
import { useToastStore } from '../../stores/uiStore'
import type { BlogPost } from '../../lib/database.types'

const CATEGORY_COLORS: Record<string, string> = {
  'Exchange Experiences': '#00bfa5',
  Leadership: '#037ef3',
  'Personal Development': '#7b2fbe',
  'Events & Announcements': '#ff6b35',
  'Member Stories': '#00c853',
  'Global Impact': '#3d5afe',
}

type FilterTab = 'all' | 'pending' | 'published' | 'draft'

export function AdminDashboardPage() {
  const { data: posts = [], isLoading: loading } = useAdminBlogPosts()
  const togglePublishMutation = useToggleBlogPublish()
  const deletePostMutation = useDeleteBlogPost()
  const approveMutation = useApproveBlogPost()
  const showToast = useToastStore((s) => s.showToast)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const togglePublish = async (post: BlogPost) => {
    try {
      const newStatus = await togglePublishMutation.mutateAsync(post)
      showToast(newStatus === 'published' ? 'Post published!' : 'Post moved to drafts.', 'success')
    } catch {
      showToast('Failed to update status.', 'error')
    }
  }

  const approvePost = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id)
      showToast('Post approved and published to public blog!', 'success')
    } catch {
      showToast('Failed to approve post.', 'error')
    }
  }

  const deletePost = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this post?')) return
    try {
      await deletePostMutation.mutateAsync(id)
      showToast('Post deleted.', 'success')
    } catch {
      showToast('Failed to delete post.', 'error')
    }
  }

  const pending = posts.filter((p) => p.status === 'pending')
  const published = posts.filter((p) => p.status === 'published')
  const drafts = posts.filter((p) => p.status === 'draft')
  const rejected = posts.filter((p) => p.status === 'rejected')

  const filteredPosts = posts.filter((p) => {
    if (activeTab === 'all') return true
    if (activeTab === 'pending') return p.status === 'pending'
    if (activeTab === 'published') return p.status === 'published'
    if (activeTab === 'draft') return p.status === 'draft' || p.status === 'rejected'
    return true
  })

  const togglingId = togglePublishMutation.isPending ? togglePublishMutation.variables?.id : null
  const deletingId = deletePostMutation.isPending ? deletePostMutation.variables : null
  const approvingId = approveMutation.isPending ? approveMutation.variables : null

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-navy text-[28px] font-extrabold">Blog Posts</h1>
          <p className="mt-1 text-[14px] text-[#6b7280]">
            {pending.length > 0 ? (
              <span className="font-semibold text-amber-600">
                {pending.length} pending review ·{' '}
              </span>
            ) : null}
            {published.length} published · {drafts.length} drafts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/posts/new"
            className="bg-brand hover:bg-brand-dark flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition-colors"
          >
            <Plus size={18} />
            New Post
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Total Posts',
            value: posts.length,
            color: 'text-navy',
            tab: 'all' as FilterTab,
          },
          {
            label: 'Pending Review',
            value: pending.length,
            color: pending.length > 0 ? 'text-amber-600' : 'text-[#6b7280]',
            badge: pending.length > 0 ? 'Needs Attention' : undefined,
            tab: 'pending' as FilterTab,
          },
          {
            label: 'Published',
            value: published.length,
            color: 'text-[#00c853]',
            tab: 'published' as FilterTab,
          },
          {
            label: 'Drafts',
            value: drafts.length + rejected.length,
            color: 'text-[#6b7280]',
            tab: 'draft' as FilterTab,
          },
        ].map(({ label, value, color, badge, tab }) => (
          <button
            key={label}
            onClick={() => setActiveTab(tab)}
            className={`cursor-pointer rounded-xl bg-white p-5 text-left shadow-sm transition-all hover:shadow-md ${
              activeTab === tab ? 'ring-brand ring-2' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#9ca3af]">{label}</p>
              {badge && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  {badge}
                </span>
              )}
            </div>
            <p className={`mt-1 text-[32px] font-extrabold ${color}`}>{value}</p>
          </button>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b border-[#f0f1f5] pb-2">
        {(
          [
            { id: 'all', label: 'All', count: posts.length },
            { id: 'pending', label: 'Pending Review', count: pending.length },
            { id: 'published', label: 'Published', count: published.length },
            { id: 'draft', label: 'Drafts', count: drafts.length + rejected.length },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
              activeTab === t.id
                ? 'bg-navy text-white'
                : 'hover:text-navy text-[#6b7280] hover:bg-white'
            }`}
          >
            <span>{t.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                activeTab === t.id
                  ? 'bg-white/20 text-white'
                  : t.id === 'pending' && t.count > 0
                    ? 'bg-amber-100 font-bold text-amber-700'
                    : 'bg-[#f0f1f5] text-[#6b7280]'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="border-brand size-8 animate-spin rounded-full border-4 border-t-transparent" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white py-20 text-center shadow-sm">
          <FileText size={40} className="text-[#e5e7eb]" />
          <p className="text-navy text-[18px] font-semibold">
            {activeTab === 'pending' ? 'No pending submissions' : 'No posts yet'}
          </p>
          <p className="text-[14px] text-[#6b7280]">
            {activeTab === 'pending'
              ? 'All student submissions have been reviewed.'
              : 'Create your first post or share the student submission link.'}
          </p>
          {activeTab !== 'pending' && (
            <Link
              to="/admin/posts/new"
              className="bg-brand hover:bg-brand-dark mt-2 flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition-colors"
            >
              <Plus size={16} />
              Create Post
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f0f1f5]">
                <th className="px-6 py-4 text-left text-[12px] font-semibold tracking-wider text-[#9ca3af] uppercase">
                  Title & Author
                </th>
                <th className="px-4 py-4 text-left text-[12px] font-semibold tracking-wider text-[#9ca3af] uppercase">
                  Category
                </th>
                <th className="px-4 py-4 text-left text-[12px] font-semibold tracking-wider text-[#9ca3af] uppercase">
                  Status
                </th>
                <th className="px-4 py-4 text-left text-[12px] font-semibold tracking-wider text-[#9ca3af] uppercase">
                  Date
                </th>
                <th className="px-6 py-4 text-right text-[12px] font-semibold tracking-wider text-[#9ca3af] uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5f7fa]">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="group transition-colors hover:bg-[#fafafa]">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      {post.cover_image_url && (
                        <img
                          src={post.cover_image_url}
                          alt=""
                          className="mt-0.5 size-10 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <p className="text-navy line-clamp-1 text-[14px] font-semibold">
                          {post.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#9ca3af]">
                          <span className="font-medium text-[#4b5563]">{post.author_name}</span>
                          {post.author_email ? ` (${post.author_email})` : ''} · {post.read_time}{' '}
                          min read
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: CATEGORY_COLORS[post.category] ?? '#037ef3' }}
                    >
                      {post.category}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold',
                        post.status === 'published'
                          ? 'bg-green-50 text-[#00c853]'
                          : post.status === 'pending'
                            ? 'border border-amber-200 bg-amber-50 text-amber-600'
                            : post.status === 'rejected'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-gray-100 text-[#6b7280]',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'size-1.5 rounded-full',
                          post.status === 'published'
                            ? 'bg-[#00c853]'
                            : post.status === 'pending'
                              ? 'animate-pulse bg-amber-500'
                              : post.status === 'rejected'
                                ? 'bg-red-500'
                                : 'bg-[#9ca3af]',
                        ].join(' ')}
                      />
                      {post.status === 'published'
                        ? 'Published'
                        : post.status === 'pending'
                          ? 'Pending Review'
                          : post.status === 'rejected'
                            ? 'Rejected'
                            : 'Draft'}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-[13px] text-[#6b7280]">
                    {new Date(post.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {/* One-click Approve for Pending */}
                      {post.status === 'pending' && (
                        <button
                          onClick={() => void approvePost(post.id)}
                          disabled={approvingId === post.id}
                          className="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                          title="Approve and Publish to Blog"
                        >
                          {approvingId === post.id ? (
                            <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Check size={14} />
                          )}
                          Approve
                        </button>
                      )}

                      {/* Toggle Publish for draft/published */}
                      {post.status !== 'pending' && (
                        <button
                          onClick={() => void togglePublish(post)}
                          disabled={togglingId === post.id}
                          title={post.status === 'published' ? 'Move to draft' : 'Publish'}
                          className={[
                            'rounded-lg p-2 transition-colors',
                            post.status === 'published'
                              ? 'text-[#9ca3af] hover:bg-orange-50 hover:text-[#ff6b35]'
                              : 'text-[#9ca3af] hover:bg-green-50 hover:text-[#00c853]',
                          ].join(' ')}
                        >
                          {togglingId === post.id ? (
                            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : post.status === 'published' ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      )}

                      <Link
                        to={`/admin/posts/${post.id}/edit`}
                        className="hover:bg-brand/10 hover:text-brand rounded-lg p-2 text-[#9ca3af] transition-colors"
                        title={post.status === 'pending' ? 'Review & Edit' : 'Edit'}
                      >
                        <PenLine size={16} />
                      </Link>

                      <button
                        onClick={() => void deletePost(post.id)}
                        disabled={deletingId === post.id}
                        className="rounded-lg p-2 text-[#9ca3af] transition-colors hover:bg-red-50 hover:text-red-500"
                        title="Delete"
                      >
                        {deletingId === post.id ? (
                          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

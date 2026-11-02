import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Eye, EyeOff, Check, Clock } from 'lucide-react'
import { useAuth } from '../../stores/authStore'
import { RichTextEditor } from '../../components/admin/RichTextEditor'
import { ImageUploader } from '../../components/admin/ImageUploader'
import { useAdminBlogPost } from '../../hooks/queries/useBlogQueries'
import { useSaveBlogPost } from '../../hooks/mutations/useBlogMutations'
import { useToastStore } from '../../stores/uiStore'
import type { BlogPostCategory, BlogPostStatus } from '../../lib/database.types'

const CATEGORIES: BlogPostCategory[] = [
  'Exchange Experiences',
  'Leadership',
  'Personal Development',
  'Events & Announcements',
  'Member Stories',
  'Global Impact',
]

interface FormData {
  title: string
  excerpt: string
  content: string
  category: BlogPostCategory
  cover_image_url: string
  author_name: string
  author_email: string
  author_avatar_url: string
  read_time: number
  status: BlogPostStatus
}

const EMPTY_FORM: FormData = {
  title: '',
  excerpt: '',
  content: '',
  category: 'Exchange Experiences',
  cover_image_url: '',
  author_name: '',
  author_email: '',
  author_avatar_url: '',
  read_time: 5,
  status: 'draft',
}

function postToForm(post: {
  title: string
  excerpt: string | null
  content: string
  category: BlogPostCategory
  cover_image_url: string | null
  author_name: string
  author_email?: string | null
  author_avatar_url: string | null
  read_time: number
  status: BlogPostStatus
}): FormData {
  return {
    title: post.title,
    excerpt: post.excerpt ?? '',
    content: post.content,
    category: post.category,
    cover_image_url: post.cover_image_url ?? '',
    author_name: post.author_name,
    author_email: post.author_email ?? '',
    author_avatar_url: post.author_avatar_url ?? '',
    read_time: post.read_time,
    status: post.status,
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-navy mb-1.5 block text-[13px] font-semibold">{label}</label>
      {hint && <p className="mb-1.5 text-[12px] text-[#9ca3af]">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls =
  'h-[44px] w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 text-[14px] text-navy placeholder:text-[#9ca3af] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export function AdminPostEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const showToast = useToastStore((s) => s.showToast)

  const { data: existingPost, isLoading: loadingPost } = useAdminBlogPost(id)
  const saveMutation = useSaveBlogPost()

  const [draft, setDraft] = useState<FormData | null>(null)
  const form = draft ?? (isEditing && existingPost ? postToForm(existingPost) : EMPTY_FORM)

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setDraft((prev) => ({ ...(prev ?? form), [key]: value }))

  const save = async (publishNow?: boolean) => {
    if (!form.title.trim() || !form.author_name.trim()) {
      showToast('Title and Author name are required.', 'error')
      return
    }

    const now = new Date().toISOString()
    const status = publishNow ? 'published' : form.status
    const payload = {
      ...form,
      status,
      published_at: status === 'published' ? now : null,
      updated_at: now,
      created_by: user?.id ?? null,
    }

    try {
      await saveMutation.mutateAsync({
        id: isEditing ? id : undefined,
        payload: isEditing ? payload : { ...payload, created_at: now },
      })
      showToast(
        publishNow ? 'Post published!' : isEditing ? 'Changes saved.' : 'Post saved as draft.',
        'success',
      )
      setTimeout(() => navigate('/admin/dashboard'), 1200)
    } catch {
      showToast('Failed to save post. Please try again.', 'error')
    }
  }

  if (loadingPost || (isEditing && !existingPost)) {
    return (
      <div className="flex justify-center py-20">
        <div className="border-brand size-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="hover:text-navy flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] text-[#6b7280] transition-colors hover:bg-white"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div>
            <h1 className="text-navy text-[24px] font-extrabold">
              {isEditing ? 'Edit Post' : 'New Post'}
            </h1>
            <p className="text-[13px] text-[#9ca3af]">
              {form.status === 'published'
                ? 'Published'
                : form.status === 'pending'
                  ? 'Pending Review'
                  : form.status === 'rejected'
                    ? 'Rejected'
                    : 'Draft'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void save(false)}
            disabled={saveMutation.isPending}
            className="text-navy flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-[14px] font-semibold transition-colors hover:bg-[#f5f7fa] disabled:opacity-60"
          >
            <Save size={16} />
            Save Draft
          </button>
          <button
            onClick={() => void save(true)}
            disabled={saveMutation.isPending}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition-colors disabled:opacity-60 ${
              form.status === 'pending'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-brand hover:bg-brand-dark'
            }`}
          >
            {form.status === 'published' ? (
              <>
                <EyeOff size={16} />
                Unpublish
              </>
            ) : form.status === 'pending' ? (
              <>
                <Check size={16} />
                Approve & Publish
              </>
            ) : (
              <>
                <Eye size={16} />
                Publish
              </>
            )}
          </button>
        </div>
      </div>

      {form.status === 'pending' && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <Clock className="size-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-[14px] font-bold text-amber-900">
                Student Submission (Pending Approval)
              </p>
              <p className="text-[12px] text-amber-700">
                Submitted by {form.author_name}
                {form.author_email ? ` (${form.author_email})` : ''}. Review the content, make any
                editorial touches, and approve to publish live on the blog.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            <Check size={16} />
            Approve &amp; Publish Now
          </button>
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <Field label="Post Title *">
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Enter an engaging title…"
                className={inputCls}
              />
            </Field>
            <div className="mt-4">
              <Field
                label="Excerpt"
                hint="Short subtitle shown directly below the post title on the article page. Also used on blog listing cards."
              >
                <textarea
                  value={form.excerpt}
                  onChange={(e) => set('excerpt', e.target.value)}
                  rows={3}
                  placeholder="A brief description of what this post is about…"
                  className="text-navy focus:border-brand focus:ring-brand/20 w-full resize-none rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-[14px] placeholder:text-[#9ca3af] focus:ring-2 focus:outline-none"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="text-navy mb-3 block text-[13px] font-semibold">
              Article Content *
            </label>
            <RichTextEditor
              content={form.content}
              onChange={(html) => set('content', html)}
              placeholder="Start writing your story…"
            />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <ImageUploader
              label="Cover Image"
              value={form.cover_image_url}
              onChange={(url) => set('cover_image_url', url)}
            />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value as BlogPostCategory)}
                className={`${inputCls} cursor-pointer`}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-navy mb-4 text-[13px] font-semibold">Author Details</p>
            <div className="flex flex-col gap-4">
              <Field label="Author Name *">
                <input
                  type="text"
                  value={form.author_name}
                  onChange={(e) => set('author_name', e.target.value)}
                  placeholder="e.g. Dilini Perera"
                  className={inputCls}
                />
              </Field>
              <Field label="Author Email" hint="Submitter contact / member email">
                <input
                  type="email"
                  value={form.author_email}
                  onChange={(e) => set('author_email', e.target.value)}
                  placeholder="e.g. dilini@aiesec.net"
                  className={inputCls}
                />
              </Field>
              <ImageUploader
                label="Author Avatar"
                value={form.author_avatar_url}
                onChange={(url) => set('author_avatar_url', url)}
              />
              <Field label="Read Time (minutes)">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={form.read_time}
                  onChange={(e) => set('read_time', Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-navy mb-3 text-[13px] font-semibold">Status &amp; Visibility</p>
            <div className="flex flex-col gap-2">
              {(
                [
                  {
                    id: 'published',
                    label: 'Published',
                    desc: 'Live and visible to everyone on the public blog',
                  },
                  {
                    id: 'pending',
                    label: 'Pending Review',
                    desc: 'Submitted by student/member awaiting approval',
                  },
                  {
                    id: 'draft',
                    label: 'Draft',
                    desc: 'Work in progress, only visible to admins',
                  },
                  {
                    id: 'rejected',
                    label: 'Rejected',
                    desc: 'Submission archived or declined',
                  },
                ] as const
              ).map((s) => (
                <label
                  key={s.id}
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    form.status === s.id
                      ? s.id === 'published'
                        ? 'border-green-500 bg-green-50/40'
                        : s.id === 'pending'
                          ? 'border-amber-400 bg-amber-50/50'
                          : s.id === 'rejected'
                            ? 'border-red-400 bg-red-50/40'
                            : 'border-brand bg-brand/5'
                      : 'border-[#e5e7eb] hover:border-[#d1d5db]',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s.id}
                    checked={form.status === s.id}
                    onChange={() => set('status', s.id)}
                    className="accent-brand mt-0.5"
                  />
                  <div>
                    <p className="text-navy text-[13px] font-semibold">{s.label}</p>
                    <p className="text-[11px] text-[#9ca3af]">{s.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

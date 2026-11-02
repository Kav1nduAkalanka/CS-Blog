import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Send,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Info,
  AlertCircle,
  Clock,
  Heart,
  Eye,
  Edit3,
  Calendar,
} from 'lucide-react'
import { RichTextEditor } from '../components/admin/RichTextEditor'
import { ImageUploader } from '../components/admin/ImageUploader'
import { useSubmitStudentPost } from '../hooks/mutations/useBlogMutations'
import { useToastStore } from '../stores/uiStore'
import { Stagger, StaggerItem } from '../components/motion/Stagger'
import { Reveal } from '../components/motion/Reveal'
import { enhanceBlogContentHtml } from '../lib/blogContent'
import type { BlogPostCategory } from '../lib/database.types'

const CATEGORIES: BlogPostCategory[] = [
  'Exchange Experiences',
  'Leadership',
  'Personal Development',
  'Events & Announcements',
  'Member Stories',
  'Global Impact',
]

const CATEGORY_COLORS: Record<BlogPostCategory, string> = {
  'Exchange Experiences': '#00bfa5',
  Leadership: '#037ef3',
  'Personal Development': '#7b2fbe',
  'Events & Announcements': '#ff6b35',
  'Member Stories': '#00c853',
  'Global Impact': '#3d5afe',
}

interface FormState {
  title: string
  excerpt: string
  content: string
  category: BlogPostCategory
  cover_image_url: string
  author_name: string
  author_email: string
  author_role: string
  author_avatar_url: string
}

const INITIAL_FORM: FormState = {
  title: '',
  excerpt: '',
  content: '',
  category: 'Exchange Experiences',
  cover_image_url: '',
  author_name: '',
  author_email: '',
  author_role: '',
  author_avatar_url: '',
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <label className="text-navy mb-1.5 flex items-center gap-1 text-[13px] font-semibold">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[12px] text-[#6b7280]">{hint}</p>}
    </div>
  )
}

const inputCls =
  'h-[46px] w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 text-[14px] text-navy placeholder:text-[#9ca3af] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export function BlogSubmissionPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const submitMutation = useSubmitStudentPost()
  const showToast = useToastStore((s) => s.showToast)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Calculate read time
  const plainText = form.content.replace(/<[^>]*>/g, '').trim()
  const wordCount = plainText.length > 0 ? plainText.split(/\s+/).length : 0
  const estimatedReadTime = Math.max(1, Math.ceil(wordCount / 200))

  const handleValidate = (): boolean => {
    setErrorMessage('')
    if (!form.title.trim()) {
      setErrorMessage('Please enter a title for your story.')
      return false
    }
    if (!form.author_name.trim()) {
      setErrorMessage('Please enter your full name in the About You section.')
      return false
    }
    if (!form.author_email.trim() || !form.author_email.includes('@')) {
      setErrorMessage('Please enter a valid contact email address.')
      return false
    }
    if (!form.content.trim() || form.content === '<p></p>') {
      setErrorMessage('Please write your story content.')
      return false
    }
    return true
  }

  const handlePerformSubmit = async () => {
    if (!handleValidate()) return

    try {
      const finalAuthorName = form.author_role.trim()
        ? `${form.author_name.trim()} (${form.author_role.trim()})`
        : form.author_name.trim()

      const result = await submitMutation.mutateAsync({
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || form.title.trim(),
        content: form.content,
        category: form.category,
        cover_image_url: form.cover_image_url,
        author_name: finalAuthorName,
        author_email: form.author_email.trim(),
        author_avatar_url: form.author_avatar_url,
        read_time: estimatedReadTime,
      })

      if (result.error) {
        setErrorMessage(result.error)
        showToast('Submission failed. Please try again.', 'error')
        return
      }

      setSubmitted(true)
      showToast('Your story has been submitted for review!', 'success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.')
      showToast('Submission failed.', 'error')
    }
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    await handlePerformSubmit()
  }

  const previewContent = enhanceBlogContentHtml(
    form.content.replace(/^(\s*<h1[^>]*>[\s\S]*?<\/h1>\s*)/i, '').trimStart(),
  )

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* ══ HERO BANNER ══ */}
      <section
        className="relative overflow-hidden py-14 sm:py-18"
        style={{ background: 'linear-gradient(165deg, #037ef3 0%, #0250a0 100%)' }}
      >
        <div className="pointer-events-none absolute -top-12 right-10 size-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute bottom-0 -left-12 size-60 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Link
            to="/blog"
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-[13px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <ArrowLeft size={14} />
            Back to Stories
          </Link>

          <Stagger inView={false}>
            <StaggerItem>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[12px] font-semibold text-white">
                <Sparkles size={14} />
                AIESEC IN COLOMBO SOUTH · CONTRIBUTOR PORTAL
              </div>
            </StaggerItem>
            <StaggerItem>
              <h1 className="text-[34px] leading-tight font-extrabold text-white sm:text-[42px]">
                Share Your Story
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-white/85 sm:text-[17px]">
                Inspire youth across Sri Lanka and the world with your exchange journey, leadership
                growth, or volunteer experience.
              </p>
            </StaggerItem>

            {/* Mode Switcher Tabs */}
            {!submitted && (
              <StaggerItem>
                <div className="mt-8 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-bold transition-all ${
                      mode === 'edit'
                        ? 'bg-white text-[#0250a0] shadow-md'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    <Edit3 size={16} />
                    Write &amp; Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('preview')
                      window.scrollTo({ top: 380, behavior: 'smooth' })
                    }}
                    className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-bold transition-all ${
                      mode === 'preview'
                        ? 'bg-white text-[#0250a0] shadow-md'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    <Eye size={16} />
                    Live Reader Preview
                  </button>
                </div>
              </StaggerItem>
            )}
          </Stagger>
        </div>
      </section>

      {/* ══ CONTENT AREA ══ */}
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {submitted ? (
          /* ── SUCCESS SCREEN ── */
          <Reveal>
            <div className="flex flex-col items-center rounded-3xl bg-white p-8 text-center shadow-lg sm:p-14">
              <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-green-50 text-green-500">
                <CheckCircle2 size={48} />
              </div>
              <span className="mb-3 rounded-full bg-amber-50 px-3.5 py-1 text-[12px] font-bold text-amber-700">
                Status: Pending Editorial Review
              </span>
              <h2 className="text-navy text-[28px] font-extrabold sm:text-[34px]">
                Thank You for Sharing Your Story!
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#6b7280] sm:text-[16px]">
                Your article{' '}
                <span className="text-navy font-semibold">"{form.title || 'Your Story'}"</span> has
                been successfully submitted. Our editorial team will review your post, ensure the
                formatting and media look great, and approve it for publishing on the live website.
              </p>

              <div className="mt-8 flex w-full max-w-md flex-col gap-3 rounded-2xl bg-slate-50 p-5 text-left text-[13px] text-slate-600">
                <div className="text-navy flex items-center gap-2 font-semibold">
                  <Clock size={16} className="text-brand" />
                  What happens next?
                </div>
                <p>
                  1. Our editors review submissions within <strong>1–2 business days</strong>.
                </p>
                <p>
                  2. Once approved, your post appears immediately on{' '}
                  <span className="text-brand font-medium">/blog</span> and on the homepage.
                </p>
                <p>
                  3. If we have any editorial questions, we will contact you at{' '}
                  <strong className="text-navy">{form.author_email}</strong>.
                </p>
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/blog"
                  className="bg-brand hover:bg-brand-dark rounded-xl px-6 py-3 text-[14px] font-semibold text-white transition-colors"
                >
                  Explore Published Stories
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setForm(INITIAL_FORM)
                    setSubmitted(false)
                    setMode('edit')
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-[14px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Submit Another Story
                </button>
              </div>
            </div>
          </Reveal>
        ) : mode === 'preview' ? (
          /* ── LIVE PREVIEW MODE ── */
          <div className="flex flex-col gap-6">
            {/* Sticky preview action bar */}
            <div className="sticky top-4 z-30 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-white/95 p-4 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2 text-[14px] font-medium text-slate-700">
                <Eye size={18} className="text-brand" />
                <span>
                  <strong>Live Reader Preview:</strong> Inspect your cover, headings, inline images, and videos.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  <Edit3 size={15} />
                  Return to Edit
                </button>
                <button
                  type="button"
                  onClick={handlePerformSubmit}
                  disabled={submitMutation.isPending}
                  className="bg-brand hover:bg-brand-dark inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-[13px] font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-60"
                >
                  {submitMutation.isPending ? (
                    'Submitting…'
                  ) : (
                    <>
                      <Send size={15} />
                      Submit Story Now
                    </>
                  )}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-[13px] text-red-700">
                <AlertCircle size={18} className="shrink-0 text-red-500" />
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Preview Article Container matching BlogArticlePage */}
            <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
              {/* Cover Hero */}
              <div className="relative min-h-[340px] overflow-hidden bg-slate-900 sm:min-h-[420px]">
                {form.cover_image_url ? (
                  <img
                    src={form.cover_image_url}
                    alt={form.title}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0 size-full"
                    style={{ background: 'linear-gradient(135deg, #037ef3 0%, #0250a0 100%)' }}
                  />
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-black/30" />

                <div className="relative flex min-h-[340px] flex-col justify-end p-6 sm:min-h-[420px] sm:p-10">
                  <span
                    className="mb-3 inline-block self-start rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: CATEGORY_COLORS[form.category] }}
                  >
                    {form.category}
                  </span>

                  <h1 className="text-[26px] leading-tight font-extrabold text-white drop-shadow-md sm:text-[38px]">
                    {form.title.trim() || 'Your Story Title Will Appear Here'}
                  </h1>

                  {form.excerpt && (
                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/90 drop-shadow sm:text-[17px]">
                      {form.excerpt}
                    </p>
                  )}

                  {/* Author meta row */}
                  <div className="mt-6 flex flex-wrap items-center gap-4 text-white/80">
                    <div className="flex items-center gap-2.5">
                      {form.author_avatar_url ? (
                        <img
                          src={form.author_avatar_url}
                          alt={form.author_name}
                          className="size-9 rounded-full border-2 border-white/50 object-cover"
                        />
                      ) : (
                        <div className="bg-brand flex size-9 items-center justify-center rounded-full text-[13px] font-bold text-white">
                          {(form.author_name || 'A')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-[14px] font-semibold text-white">
                          {form.author_name.trim() || 'Author Name'}
                        </p>
                        {form.author_role && (
                          <p className="text-[12px] text-white/70">{form.author_role}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[13px]">
                      <Calendar size={14} />
                      {formattedDate}
                    </div>

                    <div className="flex items-center gap-1.5 text-[13px]">
                      <Clock size={14} />
                      {estimatedReadTime} min read
                    </div>
                  </div>
                </div>
              </div>

              {/* Article Body */}
              <div className="p-6 sm:p-12">
                <div
                  className="prose prose-slate prose-headings:font-bold prose-headings:text-navy prose-h2:text-[20px] prose-h2:mt-8 prose-h3:text-[17px] prose-p:mb-6 prose-p:text-[16px] prose-p:leading-[1.85] prose-p:text-[#1a1a2e] prose-a:break-words prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-img:my-6 prose-img:mx-auto prose-img:block prose-img:h-auto prose-img:w-full prose-img:max-w-full prose-img:rounded-xl prose-img:shadow-md prose-strong:text-navy sm:prose-h2:text-[22px] sm:prose-h2:mt-10 sm:prose-h3:text-[18px] sm:prose-p:text-[17px] sm:prose-p:leading-[1.9] sm:prose-img:my-8 sm:prose-img:w-auto sm:prose-img:max-w-[min(100%,600px)] [&_blockquote]:border-brand max-w-none overflow-x-hidden [&_.blog-pull-quote]:mb-6 [&_.blog-pull-quote]:text-[18px] [&_.blog-pull-quote]:leading-[1.6] [&_.blog-pull-quote]:font-medium [&_.blog-pull-quote]:text-[#005bb2] [&_.blog-pull-quote]:italic sm:[&_.blog-pull-quote]:mb-8 sm:[&_.blog-pull-quote]:text-[20px] [&_blockquote]:my-6 [&_blockquote]:rounded-r-xl [&_blockquote]:border-l-4 [&_blockquote]:bg-[#ebf5ff] [&_blockquote]:px-4 [&_blockquote]:py-5 [&_blockquote]:text-[17px] [&_blockquote]:text-[#45455b] [&_blockquote]:not-italic sm:[&_blockquote]:my-8 sm:[&_blockquote]:px-8 sm:[&_blockquote]:py-6 sm:[&_blockquote]:text-[20px] [&_blockquote_p]:my-0 [&_blockquote_p]:leading-[1.7] [&_img]:!h-auto [&_img]:w-full [&_img]:!max-w-full sm:[&_img]:w-auto sm:[&_img]:!max-w-[min(100%,600px)] [&_iframe]:w-full [&_iframe]:max-w-[700px] [&_iframe]:aspect-video [&_iframe]:mx-auto [&_iframe]:my-8 [&_iframe]:block [&_iframe]:rounded-2xl [&_iframe]:shadow-md [&_p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{
                    __html:
                      previewContent ||
                      '<p class="italic text-slate-400">Your story content will be formatted and displayed here…</p>',
                  }}
                />
              </div>

              {/* Bottom confirmation footer inside preview */}
              <div className="border-t border-slate-100 bg-slate-50 p-6 text-center sm:p-8">
                <h3 className="text-navy text-[18px] font-bold">Looks good?</h3>
                <p className="mt-1 text-[14px] text-slate-600">
                  Ready to send your article to the AIESEC editorial team?
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('edit')
                      window.scrollTo({ top: 400, behavior: 'smooth' })
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-[14px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Edit3 size={16} />
                    Continue Editing
                  </button>
                  <button
                    type="button"
                    onClick={handlePerformSubmit}
                    disabled={submitMutation.isPending}
                    className="bg-brand hover:bg-brand-dark inline-flex items-center gap-2 rounded-xl px-7 py-2.5 text-[14px] font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-60"
                  >
                    <Send size={16} />
                    Submit Story for Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── SUBMISSION EDIT FORM ── */
          <form onSubmit={handleSubmitForm} className="flex flex-col gap-8">
            {/* Editorial Notice Banner */}
            <div className="flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50/80 p-5">
              <Info className="text-brand mt-0.5 size-5 shrink-0" />
              <div className="text-[13.5px] leading-relaxed text-blue-900">
                <p className="font-semibold">How the Contributor Portal works:</p>
                <p className="mt-1 text-blue-800">
                  After you submit your story, it enters our editorial queue in a{' '}
                  <strong>pending review state</strong>. Our team checks formatting, ensures all
                  photos and video embeds look perfect, and publishes it live to the blog.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-[13px] text-red-700">
                <AlertCircle size={18} className="shrink-0 text-red-500" />
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Author Information Card (Section 1) */}
            <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="bg-brand/10 text-brand flex size-10 items-center justify-center rounded-xl font-bold">
                  1
                </div>
                <div>
                  <h2 className="text-navy text-[18px] font-bold">About You (The Author)</h2>
                  <p className="text-[13px] text-[#6b7280]">
                    Your name and photo will be displayed alongside your story.
                  </p>
                </div>
              </div>

              {/* Grid with pixel-aligned inputs & hints placed underneath */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Field
                  label="Your Full Name"
                  required
                  hint="How you would like your name credited on the published article."
                >
                  <input
                    type="text"
                    value={form.author_name}
                    onChange={(e) => update('author_name', e.target.value)}
                    placeholder="e.g. Dilini Perera"
                    className={inputCls}
                    required
                  />
                </Field>

                <Field
                  label="Contact Email"
                  required
                  hint="We will only use this to update you on your article's review status."
                >
                  <input
                    type="email"
                    value={form.author_email}
                    onChange={(e) => update('author_email', e.target.value)}
                    placeholder="e.g. dilini@aiesec.net"
                    className={inputCls}
                    required
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field
                    label="Your University / AIESEC Role (Optional)"
                    hint="e.g. 'Global Volunteer in Poland' or 'Undergraduate, University of Colombo'"
                  >
                    <input
                      type="text"
                      value={form.author_role}
                      onChange={(e) => update('author_role', e.target.value)}
                      placeholder="e.g. Global Volunteer in Poland · University of Colombo"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <ImageUploader
                    label="Author Photo / Avatar (Optional)"
                    value={form.author_avatar_url}
                    onChange={(url) => update('author_avatar_url', url)}
                  />
                </div>
              </div>
            </div>

            {/* Story Details Card (Section 2) */}
            <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="bg-brand/10 text-brand flex size-10 items-center justify-center rounded-xl font-bold">
                  2
                </div>
                <div>
                  <h2 className="text-navy text-[18px] font-bold">Your Story Details</h2>
                  <p className="text-[13px] text-[#6b7280]">
                    Craft an engaging headline, choose the right category, and select a cover image.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <Field
                  label="Story Title"
                  required
                  hint="A captivating headline describing your experience."
                >
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => update('title', e.target.value)}
                    placeholder="e.g. My 6 Weeks in Germany: How Leaving My Comfort Zone Changed Everything"
                    className={inputCls}
                    required
                  />
                </Field>

                <Field label="Category" required hint="Select the primary topic of your story.">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CATEGORIES.map((cat) => {
                      const isSelected = form.category === cat
                      const color = CATEGORY_COLORS[cat]
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => update('category', cat)}
                          className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                            isSelected
                              ? 'border-brand bg-brand/5 ring-brand text-navy font-semibold ring-1'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-[13px]">{cat}</span>
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <Field
                  label="Short Excerpt / Teaser"
                  hint="2–3 sentences summarizing your experience. Appears on blog cards and social previews."
                >
                  <textarea
                    value={form.excerpt}
                    onChange={(e) => update('excerpt', e.target.value)}
                    rows={3}
                    placeholder="Briefly describe what your experience was like and the key takeaway readers will discover…"
                    className="focus:border-brand focus:ring-brand/20 text-navy w-full resize-none rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4 text-[14px] placeholder:text-[#9ca3af] focus:ring-2 focus:outline-none"
                  />
                </Field>

                <ImageUploader
                  label="Story Cover Photo"
                  value={form.cover_image_url}
                  onChange={(url) => update('cover_image_url', url)}
                />
              </div>
            </div>

            {/* Rich Text Editor Card (Section 3) */}
            <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="bg-brand/10 text-brand flex size-10 items-center justify-center rounded-xl font-bold">
                  3
                </div>
                <div>
                  <h2 className="text-navy text-[18px] font-bold">Story Content &amp; Media</h2>
                  <p className="text-[13px] text-[#6b7280]">
                    Write your article using headings, pull quotes, bold highlights, inline photos,
                    and embedded YouTube videos.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <RichTextEditor
                  content={form.content}
                  onChange={(html) => update('content', html)}
                  placeholder="Start writing your story here… Share the highlights of your exchange, cultural surprises, friendships made, and leadership lessons learned!"
                />
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex flex-col items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:p-8">
              <div className="flex items-center gap-3 text-slate-500">
                <Heart className="size-5 text-red-500" />
                <p className="text-[13px]">
                  Thank you for contributing to the AIESEC Colombo South community!
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setMode('preview')
                    window.scrollTo({ top: 350, behavior: 'smooth' })
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3.5 text-[14px] font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <Eye size={17} />
                  Preview Story
                </button>

                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="bg-brand hover:bg-brand-dark shadow-brand/20 flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-[15px] font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-60"
                >
                  {submitMutation.isPending ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Submitting Story…
                    </>
                  ) : (
                    <>
                      <Send size={17} />
                      Submit Story for Review
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

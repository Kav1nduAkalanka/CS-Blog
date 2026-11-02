import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Clock, Calendar, Share2, Link2, Check } from 'lucide-react'
import { useBlogPost, useBlogPosts } from '../hooks/useBlogPosts'
import { enhanceBlogContentHtml } from '../lib/blogContent'
import { Stagger, StaggerItem } from '../components/motion/Stagger'
import { Reveal } from '../components/motion/Reveal'

const CATEGORY_COLORS: Record<string, string> = {
  'Exchange Experiences': '#00bfa5',
  Leadership: '#037ef3',
  'Personal Development': '#7b2fbe',
  'Events & Announcements': '#ff6b35',
  'Member Stories': '#00c853',
  'Global Impact': '#3d5afe',
}

function RelatedCard({
  post,
}: {
  post: {
    id: string
    title: string
    excerpt: string
    cover_image_url: string | null
    author_name: string
    author_avatar_url: string | null
    read_time: number
    category: string
  }
}) {
  return (
    <Link
      to={`/blog/${post.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0px_4px_20px_0px_rgba(26,26,46,0.07)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0px_8px_32px_0px_rgba(26,26,46,0.12)]"
    >
      <div className="relative h-[190px] shrink-0 overflow-hidden">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="size-full bg-[#e5e7eb]" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-white/60 to-transparent" />
        <div className="absolute bottom-2 left-3">
          <span
            className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
            style={{ backgroundColor: CATEGORY_COLORS[post.category] ?? '#037ef3' }}
          >
            {post.category}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col bg-white p-5">
        <h3 className="text-navy line-clamp-2 text-[15px] leading-[1.45] font-bold">
          {post.title}
        </h3>
        <p className="mt-2.5 line-clamp-2 text-[13px] leading-[1.6] text-[#6b7280]">
          {post.excerpt}
        </p>
        <div className="border-surface mt-auto flex items-center gap-2 border-t pt-4">
          {post.author_avatar_url && (
            <img
              src={post.author_avatar_url}
              alt={post.author_name}
              className="size-7 rounded-full border-2 border-[#e5e7eb] object-cover"
            />
          )}
          <p className="text-[12px]">
            <span className="text-navy font-semibold">{post.author_name}</span>
            <span className="text-[#9ca3af]"> · {post.read_time} min read</span>
          </p>
        </div>
      </div>
    </Link>
  )
}

export function BlogArticlePage() {
  const { id } = useParams<{ id: string }>()
  const { post, loading, error } = useBlogPost(id ?? '')
  const { posts: allPosts } = useBlogPosts()

  const relatedPosts = allPosts
    .filter((p) => p.id !== id && p.category === post?.category)
    .slice(0, 3)

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const [copied, setCopied] = useState(false)

  // Strip a leading <h1> from the content so it never duplicates the hero title
  const articleContent = post?.content
    ? enhanceBlogContentHtml(
        post.content.replace(/^(\s*<h1[^>]*>[\s\S]*?<\/h1>\s*)/i, '').trimStart(),
      )
    : ''

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border-brand size-10 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-navy text-[20px] font-bold">Post not found</p>
        <p className="text-[15px] text-[#6b7280]">
          This article doesn't exist or has been removed.
        </p>
        <Link
          to="/blog"
          className="bg-brand hover:bg-brand-dark mt-2 rounded-xl px-6 py-2.5 text-[14px] font-semibold text-white transition-colors"
        >
          Back to Blog
        </Link>
      </div>
    )
  }

  const formattedDate = new Date(post.published_at ?? post.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const categoryColor = CATEGORY_COLORS[post.category] ?? '#037ef3'

  return (
    <div className="overflow-x-hidden">
      {/* ══ HERO BANNER ══ */}
      <section className="relative min-h-[30rem] overflow-hidden sm:h-[420px]">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, #037ef3 0%, #0250a0 100%)' }}
          />
        )}
        {/* Dark overlay — strong enough for any cover image including light/gray photos */}
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/55 to-black/10" />

        <div className="relative z-10 flex min-h-[30rem] flex-col justify-between sm:h-[420px] sm:min-h-0">
          {/* Back link */}
          <div className="flex px-4 pt-4 sm:px-8 sm:pt-6">
            <Link
              to="/blog"
              className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-[12px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 sm:px-4 sm:text-[13px]"
            >
              <ArrowLeft size={14} />
              Back to Blog
            </Link>
          </div>

          {/* Article meta over image */}
          <div className="px-4 pb-6 sm:px-8 sm:pb-10">
            <Stagger inView={false} className="mx-auto max-w-[800px]">
              <StaggerItem>
                <span
                  className="mb-2 inline-block rounded-full px-3 py-1.5 text-[11px] font-semibold text-white drop-shadow sm:mb-3"
                  style={{ backgroundColor: categoryColor }}
                >
                  {post.category}
                </span>
              </StaggerItem>
              <StaggerItem>
                <h1
                  className="text-[22px] leading-[1.3] font-extrabold tracking-[-0.3px] text-white sm:text-[36px] sm:leading-[1.2] sm:tracking-[-0.5px]"
                  style={{ textShadow: '0 2px 16px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.7)' }}
                >
                  {post.title}
                </h1>
              </StaggerItem>
              {post.excerpt && (
                <StaggerItem>
                  <p
                    className="mt-2 max-w-[700px] text-[14px] leading-[1.6] font-normal text-white/85 sm:mt-3 sm:text-[17px] sm:leading-[1.65]"
                    style={{ textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}
                  >
                    {post.excerpt}
                  </p>
                </StaggerItem>
              )}
              <StaggerItem>
                <div
                  className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mt-4 sm:gap-4"
                  style={{ textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}
                >
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    {post.author_avatar_url && (
                      <img
                        src={post.author_avatar_url}
                        alt={post.author_name}
                        className="size-8 rounded-full border-2 border-white/40 object-cover sm:size-9"
                      />
                    )}
                    <span className="text-[13px] font-semibold text-white sm:text-[14px]">
                      {post.author_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-white/75 sm:text-[13px]">
                    <Calendar size={13} />
                    {formattedDate}
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-white/75 sm:text-[13px]">
                    <Clock size={13} />
                    {post.read_time} min read
                  </div>
                </div>
              </StaggerItem>
            </Stagger>
          </div>
        </div>
      </section>

      {/* ══ ARTICLE BODY ══ */}
      <div className="overflow-x-hidden bg-white">
        <div className="relative mx-auto max-w-[960px] px-4 py-10 sm:py-14">
          {/* ── Vertical share sidebar (lg+) ── */}
          <div className="absolute inset-y-14 left-4 hidden w-14 lg:block">
            <div className="sticky top-28 flex flex-col items-center gap-3">
              <span
                className="mb-1 text-[10px] font-semibold tracking-[0.18em] text-[#9ca3af] uppercase"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                Share
              </span>

              {/* X / Twitter */}
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#9ca3af] transition-colors hover:border-black hover:text-black"
                aria-label="Share on X"
              >
                <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
                </svg>
              </a>

              {/* Facebook */}
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#9ca3af] transition-colors hover:border-[#1877F2] hover:text-[#1877F2]"
                aria-label="Share on Facebook"
              >
                <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
                  <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.532-4.697 1.313 0 2.686.235 2.686.235v2.97H15.83c-1.491 0-1.956.93-1.956 1.886v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#9ca3af] transition-colors hover:border-[#0A66C2] hover:text-[#0A66C2]"
                aria-label="Share on LinkedIn"
              >
                <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>

              {/* Copy link */}
              <button
                onClick={copyLink}
                className="hover:border-brand hover:text-brand flex size-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#9ca3af] transition-colors"
                aria-label="Copy link"
              >
                {copied ? <Check size={15} className="text-[#00c853]" /> : <Link2 size={15} />}
              </button>
            </div>
          </div>

          {/* ── Article content ── */}
          <Reveal className="mx-auto w-full max-w-[800px] min-w-0">
            {/* Article content (rich HTML from TipTap — leading h1 stripped to avoid duplication with hero) */}
            <div
              className="prose prose-slate prose-headings:font-bold prose-headings:text-navy prose-h2:text-[20px] prose-h2:mt-8 prose-h3:text-[17px] prose-p:mb-6 prose-p:text-[16px] prose-p:leading-[1.85] prose-p:text-[#1a1a2e] prose-a:break-words prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-img:my-6 prose-img:mx-auto prose-img:block prose-img:h-auto prose-img:w-full prose-img:max-w-full prose-img:rounded-xl prose-img:shadow-md prose-strong:text-navy sm:prose-h2:text-[22px] sm:prose-h2:mt-10 sm:prose-h3:text-[18px] sm:prose-p:text-[17px] sm:prose-p:leading-[1.9] sm:prose-img:my-8 sm:prose-img:w-auto sm:prose-img:max-w-[min(100%,600px)] [&_blockquote]:border-brand max-w-none overflow-x-hidden [&_.blog-pull-quote]:mb-6 [&_.blog-pull-quote]:text-[18px] [&_.blog-pull-quote]:leading-[1.6] [&_.blog-pull-quote]:font-medium [&_.blog-pull-quote]:text-[#005bb2] [&_.blog-pull-quote]:italic sm:[&_.blog-pull-quote]:mb-8 sm:[&_.blog-pull-quote]:text-[20px] [&_blockquote]:my-6 [&_blockquote]:rounded-r-xl [&_blockquote]:border-l-4 [&_blockquote]:bg-[#ebf5ff] [&_blockquote]:px-4 [&_blockquote]:py-5 [&_blockquote]:text-[17px] [&_blockquote]:text-[#45455b] [&_blockquote]:not-italic sm:[&_blockquote]:my-8 sm:[&_blockquote]:px-8 sm:[&_blockquote]:py-6 sm:[&_blockquote]:text-[20px] [&_blockquote_p]:my-0 [&_blockquote_p]:leading-[1.7] [&_img]:!h-auto [&_img]:w-full [&_img]:!max-w-full sm:[&_img]:w-auto sm:[&_img]:!max-w-[min(100%,600px)] [&_iframe]:w-full [&_iframe]:max-w-[700px] [&_iframe]:aspect-video [&_iframe]:mx-auto [&_iframe]:my-8 [&_iframe]:block [&_iframe]:rounded-2xl [&_iframe]:shadow-md [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: articleContent }}
            />

            {/* Mobile share row (hidden on lg+) */}
            <div className="mt-12 flex items-center gap-3 border-t border-[#f0f1f5] pt-8 lg:hidden">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-[#9ca3af]">
                <Share2 size={15} />
                Share
              </span>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#9ca3af] transition-colors hover:border-black hover:text-black"
                aria-label="Share on X"
              >
                <svg viewBox="0 0 24 24" className="size-4 fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
                </svg>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#9ca3af] transition-colors hover:border-[#1877F2] hover:text-[#1877F2]"
                aria-label="Share on Facebook"
              >
                <svg viewBox="0 0 24 24" className="size-4 fill-current">
                  <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.532-4.697 1.313 0 2.686.235 2.686.235v2.97H15.83c-1.491 0-1.956.93-1.956 1.886v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
                </svg>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#9ca3af] transition-colors hover:border-[#0A66C2] hover:text-[#0A66C2]"
                aria-label="Share on LinkedIn"
              >
                <svg viewBox="0 0 24 24" className="size-4 fill-current">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <button
                onClick={copyLink}
                className="hover:border-brand hover:text-brand flex size-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#9ca3af] transition-colors"
                aria-label="Copy link"
              >
                {copied ? <Check size={15} className="text-[#00c853]" /> : <Link2 size={15} />}
              </button>
            </div>

            {/* Author bio */}
            <div className="bg-surface mt-10 flex items-start gap-5 rounded-2xl p-6">
              {post.author_avatar_url ? (
                <img
                  src={post.author_avatar_url}
                  alt={post.author_name}
                  className="size-14 shrink-0 rounded-full border-2 border-white object-cover shadow"
                />
              ) : (
                <div className="bg-brand flex size-14 shrink-0 items-center justify-center rounded-full text-[20px] font-bold text-white shadow">
                  {post.author_name.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-navy text-[15px] font-bold">{post.author_name}</p>
                <p className="text-brand mt-0.5 text-[12px] font-semibold tracking-wider uppercase">
                  AIESEC in Colombo South
                </p>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#6b7280]">
                  Member of AIESEC in Colombo South, sharing their experiences and insights from
                  their journey with the organisation.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
        {/* end relative outer */}
      </div>

      {/* ══ MORE STORIES ══ */}
      {relatedPosts.length > 0 && (
        <Reveal as="section" className="bg-surface overflow-x-hidden px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-[1280px]">
            <h2 className="text-navy mb-8 text-[26px] font-extrabold">More Stories Like This</h2>
            <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((p) => (
                <StaggerItem key={p.id}>
                  <RelatedCard post={p} />
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </Reveal>
      )}
    </div>
  )
}

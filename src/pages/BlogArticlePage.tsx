import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import { ArrowLeft, ChevronDown, PenLine, Plane } from 'lucide-react'
import { useBlogPost, useBlogPosts } from '../hooks/useBlogPosts'
import { enhanceBlogContentHtml } from '../lib/blogContent'
import { sanitizePostHtml } from '../lib/sanitizeHtml'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { ShareButtons } from '../components/blog/ShareButtons'
import { JourneyStory } from '../components/blog/JourneyStory'
import {
  categoryColor,
  formatStoryDate,
  parseStory,
  sortStories,
  type StoryChapter,
} from '../components/blog/storyUtils'
import type { BlogPost } from '../lib/database.types'

function MoreStoryCard({ post, label }: { post: BlogPost; label: string }) {
  return (
    <Link
      to={`/blog/${post.id}`}
      className="group focus-visible:outline-brand relative block aspect-[4/3] overflow-hidden rounded-[14px] bg-[#10213f] focus-visible:outline-2 focus-visible:outline-offset-2 sm:aspect-[16/10]"
    >
      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,22,44,.92),rgba(10,22,44,.2)_65%)]" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
        <p className="text-[13px] text-white/75">{label}</p>
        <h3 className="font-display mt-1 text-[22px] leading-[1.15] font-semibold text-balance">
          {post.title}
        </h3>
        <p className="mt-2 text-[13px] text-white/75">
          {post.author_name}, {post.read_time} min read
        </p>
      </div>
    </Link>
  )
}

interface ParsedStory {
  intro: string
  chapters: StoryChapter[]
}

/** The classic layout: cover, chapter rail and one column of text. */
function PlainStory({
  post,
  story,
  color,
  onJourney,
}: {
  post: BlogPost
  story: ParsedStory
  color: string
  onJourney: () => void
}) {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28 })

  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress: heroP } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const coverScale = useTransform(heroP, [0, 1], [1, 1.2])
  const titleY = useTransform(heroP, [0, 1], ['0%', '40%'])
  const titleOpacity = useTransform(heroP, [0, 0.7], [1, 0])

  // Which chapter is on screen, for the chapter rail
  const [active, setActive] = useState<string>('')
  useEffect(() => {
    if (!story.chapters.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-35% 0px -55% 0px' },
    )
    story.chapters.forEach((c) => {
      const el = document.getElementById(c.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [story.chapters])

  const jump = (chapterId: string) =>
    document
      .getElementById(chapterId)
      ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })

  const activeIndex = story.chapters.findIndex((c) => c.id === active)

  return (
    <>
      <motion.div
        className="fixed inset-x-0 top-0 z-[60] h-1 origin-left"
        style={{ scaleX: progress, background: color }}
        aria-hidden="true"
      />

      {/* ══ COVER ══ */}
      <section
        ref={heroRef}
        className="relative flex h-svh min-h-[620px] items-end overflow-hidden bg-[#10213f]"
      >
        <motion.div
          className="absolute inset-0"
          style={reduced ? undefined : { scale: coverScale }}
        >
          {post.cover_image_url ? (
            <img src={post.cover_image_url} alt="" className="size-full object-cover" />
          ) : (
            <div className="size-full bg-[linear-gradient(140deg,#037ef3,#10213f)]" />
          )}
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(to_top,#0b1830_5%,rgba(11,24,48,.6)_45%,rgba(11,24,48,.1))]" />

        <Link
          to="/blog"
          state={{ hall: true }}
          className="absolute top-28 left-6 z-10 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white md:left-10"
        >
          <ArrowLeft size={15} />
          Story House
        </Link>
        <button
          type="button"
          onClick={onJourney}
          className="absolute top-28 right-6 z-10 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white md:right-10"
        >
          <Plane size={15} className="rotate-45" />
          Read as a journey
        </button>

        <motion.div
          className="relative z-10 mx-auto w-full max-w-[1100px] px-6 pb-20 md:px-10"
          style={reduced ? undefined : { y: titleY, opacity: titleOpacity }}
        >
          <span
            className="inline-block rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white"
            style={{ background: color }}
          >
            {post.category}
          </span>
          <h1 className="font-display mt-5 max-w-[900px] text-[40px] leading-[1.02] font-bold tracking-[-0.02em] text-balance text-white sm:text-[60px] lg:text-[76px]">
            {post.title}
          </h1>
          <div className="mt-8 flex items-center gap-3">
            {post.author_avatar_url ? (
              <img
                src={post.author_avatar_url}
                alt=""
                className="size-12 rounded-full border-2 border-white/60 object-cover"
              />
            ) : (
              <span
                className="flex size-12 items-center justify-center rounded-full text-[16px] font-bold text-white"
                style={{ background: color }}
              >
                {post.author_name.charAt(0)}
              </span>
            )}
            <div className="text-[14px] leading-tight text-white">
              <p className="font-semibold">A story by {post.author_name}</p>
              <p className="mt-1 text-white/65">
                {formatStoryDate(post, 'long')}, {post.read_time} min read
                {story.chapters.length > 0 && `, ${story.chapters.length} chapters`}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-white/70"
          animate={reduced ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          aria-hidden="true"
        >
          <ChevronDown size={26} />
        </motion.div>
      </section>

      {/* ══ OPENING ══ */}
      <section className="bg-white px-6 pt-20 pb-6 md:px-10">
        <div className="mx-auto max-w-[680px]">
          {post.excerpt && (
            <p className="font-display text-[24px] leading-[1.4] font-medium text-[#10213f] md:text-[28px]">
              {post.excerpt}
            </p>
          )}
        </div>
      </section>

      {/* ══ STORY ══ */}
      <div className="bg-white px-6 pb-20 md:px-10">
        <div className="relative mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[200px_minmax(0,680px)] lg:justify-between xl:grid-cols-[220px_minmax(0,680px)_120px]">
          {/* chapter rail */}
          <aside className="hidden lg:block">
            {story.chapters.length > 0 && (
              <nav className="sticky top-32" aria-label="Chapters">
                <p className="text-[13px] text-[#10213f]/55">In this story</p>
                <ol className="relative mt-4 space-y-5 border-l-2 border-[#e1e9f5] pl-5">
                  <span
                    className="absolute top-0 -left-[2px] w-[2px] transition-all duration-500"
                    style={{
                      background: color,
                      height:
                        activeIndex < 0
                          ? 0
                          : `${((activeIndex + 1) / story.chapters.length) * 100}%`,
                    }}
                    aria-hidden="true"
                  />
                  {story.chapters.map((c, i) => {
                    const done = i <= activeIndex
                    return (
                      <li key={c.id} className="relative">
                        <span
                          className="absolute top-[5px] -left-[27px] size-3 rounded-full border-2 bg-white transition-colors"
                          style={{
                            borderColor: done ? color : '#cbd8ea',
                            background: done ? color : 'white',
                          }}
                          aria-hidden="true"
                        />
                        <button
                          onClick={() => jump(c.id)}
                          className="focus-visible:outline-brand rounded text-left text-[14px] leading-[1.35] transition-colors focus-visible:outline-2"
                          style={{
                            color: c.id === active ? '#10213f' : 'rgba(16,33,63,.55)',
                            fontWeight: c.id === active ? 600 : 400,
                          }}
                          aria-current={c.id === active ? 'step' : undefined}
                        >
                          {c.title}
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </nav>
            )}
          </aside>

          <article className="min-w-0">
            {story.intro && (
              <div
                className="story-body story-intro"
                dangerouslySetInnerHTML={{ __html: story.intro }}
              />
            )}

            {story.chapters.map((c, i) => (
              <section key={c.id} id={c.id} className="scroll-mt-28 pt-16">
                <header className="mb-8">
                  <p className="text-[14px] font-semibold" style={{ color }}>
                    Chapter {i + 1}
                  </p>
                  <h2 className="font-display mt-1 text-[32px] leading-[1.1] font-bold text-balance text-[#10213f] md:text-[40px]">
                    {c.title}
                  </h2>
                </header>
                <div className="story-body" dangerouslySetInnerHTML={{ __html: c.html }} />
              </section>
            ))}

            {/* the end */}
            <div className="mt-20 flex items-center gap-4">
              <span className="h-px flex-1 bg-[#e1e9f5]" />
              <span className="font-display text-[18px] text-[#10213f]/60">The end, for now</span>
              <span className="h-px flex-1 bg-[#e1e9f5]" />
            </div>

            <div className="mt-12 flex items-start gap-4">
              {post.author_avatar_url ? (
                <img
                  src={post.author_avatar_url}
                  alt=""
                  className="size-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex size-16 shrink-0 items-center justify-center rounded-full text-[22px] font-bold text-white"
                  style={{ background: color }}
                >
                  {post.author_name.charAt(0)}
                </span>
              )}
              <div>
                <p className="font-display text-[22px] font-semibold text-[#10213f]">
                  {post.author_name}
                </p>
                <p className="mt-1 text-[15px] leading-[1.6] text-[#10213f]/70">
                  Part of the AIESEC in Colombo South community. If this story stayed with you, pass
                  it to someone who needs it.
                </p>
                <ShareButtons post={post} className="mt-4 flex-wrap" />
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  )
}

const VIEW_KEY = 'cs-story-view'

export function BlogArticlePage() {
  const { id } = useParams<{ id: string }>()
  const { post, loading, error } = useBlogPost(id ?? '')
  const { posts: allPosts } = useBlogPosts()
  const [view, setView] = useState<'journey' | 'article'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'article' ? 'article' : 'journey'
    } catch {
      return 'journey'
    }
  })
  const changeView = (v: 'journey' | 'article') => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* not saved: the choice lasts for this visit */
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const content = post?.content
  const story = useMemo(() => {
    if (!content) return { intro: '', chapters: [] }
    const html = enhanceBlogContentHtml(
      content.replace(/^(\s*<h1[^>]*>[\s\S]*?<\/h1>\s*)/i, '').trimStart(),
    )
    const { intro, chapters } = parseStory(html)
    return {
      intro: sanitizePostHtml(intro),
      chapters: chapters.map((c) => ({ ...c, html: sanitizePostHtml(c.html) })),
    }
  }, [content])

  const { previous, next, related } = useMemo(() => {
    const ordered = sortStories(allPosts)
    const i = ordered.findIndex((p) => p.id === id)
    const prevP = i >= 0 ? ordered[i + 1] : undefined
    const nextP = i > 0 ? ordered[i - 1] : undefined
    return {
      previous: prevP,
      next: nextP,
      related: ordered
        .filter(
          (p) =>
            p.id !== id &&
            p.id !== prevP?.id &&
            p.id !== nextP?.id &&
            p.category === post?.category,
        )
        .slice(0, 1),
    }
  }, [allPosts, id, post?.category])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border-brand size-10 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 pt-24 text-center">
        <p className="font-display text-[28px] font-bold text-[#10213f]">
          We couldn't find this story
        </p>
        <p className="text-[15px] text-[#10213f]/70">It may have been moved or unpublished.</p>
        <Link
          to="/blog"
          className="bg-brand mt-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white"
        >
          Back to the Story House
        </Link>
      </div>
    )
  }

  const color = categoryColor(post.category)
  const journeyNext = next ?? previous
  // journey view: the other pages hanging in the same wing of the hall come first
  const wingMates = allPosts
    .filter((p) => p.id !== post.id && p.id !== journeyNext?.id && p.category === post.category)
    .slice(0, 2)
  const more =
    view === 'journey' && wingMates.length > 0
      ? wingMates.map((p) => ({ post: p, label: `More from ${post.category}` }))
      : [
          next && { post: next, label: 'Newer story' },
          previous && { post: previous, label: 'Older story' },
          related[0] && { post: related[0], label: `More from ${post.category}` },
        ].filter(
          (m): m is { post: BlogPost; label: string } =>
            !!m && (view === 'article' || m.post.id !== journeyNext?.id),
        )

  return (
    <div className="overflow-x-clip" style={{ ['--story-accent' as string]: color }}>
      {view === 'journey' ? (
        <JourneyStory
          post={post}
          intro={story.intro}
          chapters={story.chapters}
          next={journeyNext}
          onPlain={() => changeView('article')}
        />
      ) : (
        <PlainStory
          post={post}
          story={story}
          color={color}
          onJourney={() => changeView('journey')}
        />
      )}

      {/* ══ MORE + WRITE ══ */}
      <section className="bg-[#f3f7fd] px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1100px]">
          {more.length > 0 && (
            <h2 className="font-display mb-8 text-[32px] leading-[1.1] font-bold text-[#10213f] md:text-[42px]">
              {view !== 'journey'
                ? 'Read another story'
                : wingMates.length > 0
                  ? 'More pages from this chapter'
                  : 'More journeys'}
            </h2>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            {more.map((m) => (
              <MoreStoryCard key={m.post.id} post={m.post} label={m.label} />
            ))}
          </div>

          <div
            className={`${more.length ? 'mt-10' : ''} grid items-center gap-6 rounded-[14px] bg-[#10213f] p-8 text-white md:grid-cols-[1fr_auto] md:p-10`}
          >
            <div>
              <p className="font-display text-[28px] leading-[1.15] font-semibold md:text-[32px]">
                Got a moment like this of your own?
              </p>
              <p className="mt-2 max-w-[520px] text-[15px] leading-[1.7] text-white/70">
                Write it the way you'd tell a friend. We'll help with editing and photos before it
                goes live.
              </p>
            </div>
            <Link
              to="/blog/submit"
              className="flex items-center justify-center gap-2 rounded-full bg-[#ffc845] px-7 py-3.5 text-[15px] font-semibold whitespace-nowrap text-[#10213f] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc845]"
            >
              <PenLine size={17} />
              Write your story
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

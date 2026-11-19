import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { PenLine, Plus, Search } from 'lucide-react'
import { useBlogPosts } from '../hooks/useBlogPosts'
import type { BlogPost } from '../lib/database.types'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { StoryViewer } from '../components/blog/StoryViewer'
import { StoryGlobe } from '../components/blog/StoryGlobe'
import { HomeJourney } from '../components/blog/HomeJourney'
import { homeStories } from '../components/blog/destinations'
import {
  STORY_CHAPTERS,
  categoryColor,
  formatStoryDate,
  sortStories,
  storyHighlights,
} from '../components/blog/storyUtils'

const WRITING_PROMPTS = [
  'The first night in a country you had never seen',
  'A moment you led when nobody asked you to',
  'Something an exchange taught you that a classroom never could',
]

/* ─── Tilt: the card leans toward the pointer in 3D ─── */

function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [t, setT] = useState({ x: 0, y: 0, on: false })

  return (
    <div
      ref={ref}
      className={['[perspective:1100px]', className].join(' ')}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== 'mouse' || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        setT({
          x: (e.clientX - r.left) / r.width - 0.5,
          y: (e.clientY - r.top) / r.height - 0.5,
          on: true,
        })
      }}
      onPointerLeave={() => setT({ x: 0, y: 0, on: false })}
    >
      <div
        className="relative size-full transition-transform duration-300 ease-out transform-3d"
        style={{
          transform: `rotateY(${t.x * 10}deg) rotateX(${-t.y * 10}deg) translateZ(${t.on ? 12 : 0}px)`,
        }}
      >
        {children}
        {/* moving glare */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: t.on ? 1 : 0,
            background: `radial-gradient(circle at ${(t.x + 0.5) * 100}% ${(t.y + 0.5) * 100}%, rgba(255,255,255,.28), transparent 55%)`,
          }}
        />
      </div>
    </div>
  )
}

/* ─── Card variants ─── */

type Variant = 'feature' | 'photo' | 'wide' | 'quote'

function variantFor(i: number): Variant {
  if (i === 0) return 'feature'
  if (i % 5 === 2) return 'quote'
  if (i % 5 === 4) return 'wide'
  return 'photo'
}

const SPAN: Record<Variant, string> = {
  feature: 'sm:col-span-2 row-span-2',
  photo: 'row-span-1',
  wide: 'sm:col-span-2 row-span-1',
  quote: 'row-span-1',
}

function StoryCard({ post, variant }: { post: BlogPost; variant: Variant }) {
  const color = categoryColor(post.category)
  const quote = useMemo(() => storyHighlights(post.content).quote, [post.content])

  if (variant === 'quote') {
    return (
      <Link
        to={`/blog/${post.id}`}
        className="focus-visible:outline-brand flex size-full flex-col justify-between rounded-[14px] p-6 text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: color }}
      >
        <p className="font-display line-clamp-5 text-[21px] leading-[1.25] font-semibold">
          “{quote ?? post.excerpt}”
        </p>
        <div>
          <p className="text-[14px] font-semibold">{post.author_name}</p>
          <p className="mt-0.5 line-clamp-1 text-[13px] text-white/80">{post.title}</p>
        </div>
      </Link>
    )
  }

  const big = variant === 'feature'
  return (
    <Link
      to={`/blog/${post.id}`}
      className="group focus-visible:outline-brand relative block size-full overflow-hidden rounded-[14px] bg-[#10213f] focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {post.cover_image_url ? (
        <img
          src={post.cover_image_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(140deg,#037ef3,#10213f)]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,22,44,.92)_0%,rgba(10,22,44,.35)_50%,transparent_75%)]" />
      <span
        className="absolute top-4 left-4 rounded-full px-3 py-1 text-[12px] font-semibold text-white"
        style={{ background: color }}
      >
        {post.category}
      </span>
      <div className={`absolute inset-x-0 bottom-0 text-white ${big ? 'p-7 md:p-9' : 'p-5'}`}>
        <h3
          className={`font-display font-semibold text-balance ${
            big
              ? 'text-[30px] leading-[1.08] md:text-[40px]'
              : 'line-clamp-3 text-[19px] leading-[1.2]'
          }`}
        >
          {post.title}
        </h3>
        {big && (
          <p className="mt-3 line-clamp-2 max-w-[560px] text-[15px] leading-[1.6] text-white/80">
            {post.excerpt}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2.5 text-[13px] text-white/80">
          {post.author_avatar_url && (
            <img
              src={post.author_avatar_url}
              alt=""
              className="size-7 rounded-full border border-white/50 object-cover"
            />
          )}
          <span>
            <span className="font-semibold text-white">{post.author_name}</span>, {post.read_time}{' '}
            min read
          </span>
        </div>
      </div>
    </Link>
  )
}

/* ─── Page ─── */

export function BlogPage() {
  const [chapter, setChapter] = useState<string>('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewerAt, setViewerAt] = useState<number | null>(null)
  const { posts: allPosts, loading } = useBlogPosts()

  const latest = useMemo(() => sortStories(allPosts), [allPosts])
  const home = useMemo(() => homeStories(latest), [latest])
  const reduced = useReducedMotion()

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return latest.filter(
      (p) =>
        (chapter === 'All' || p.category === chapter) &&
        (!q ||
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.author_name.toLowerCase().includes(q)),
    )
  }, [latest, chapter, searchTerm])

  return (
    <>
      {/* ══ HERO + STORY RINGS ══ */}
      <section className="relative overflow-hidden bg-[#10213f] px-6 pt-32 pb-14 text-white md:px-10 md:pt-36">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-[#037ef3]/25 blur-3xl" />
        <div className="relative mx-auto max-w-[1200px]">
          <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-12">
            <div className="max-w-[640px]">
              <h1 className="font-display text-[44px] leading-[1.02] font-bold tracking-[-0.02em] sm:text-[60px]">
                Stories from the people who went.
              </h1>
              <p className="mt-5 text-[17px] leading-[1.7] text-white/75">
                Spin the globe to see where our members have been, tap a face to watch a story in
                under a minute, or open one below and read it in full.
              </p>
              <Link
                to="/blog/submit"
                className="mt-8 inline-flex shrink-0 items-center gap-2 rounded-full bg-[#ffc845] px-6 py-3.5 text-[15px] font-semibold text-[#10213f] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc845]"
              >
                <PenLine size={17} />
                Write your story
              </Link>

              <ul
                className="-mx-6 mt-10 flex gap-5 overflow-x-auto px-6 pb-2 md:mx-0 md:px-0"
                aria-label="Quick stories"
              >
                <li className="shrink-0">
                  <Link
                    to="/blog/submit"
                    className="group flex w-[88px] flex-col items-center gap-2 focus-visible:outline-none"
                  >
                    <span className="flex size-[84px] items-center justify-center rounded-full border-2 border-dashed border-white/50 text-white transition-colors group-hover:border-[#ffc845] group-hover:text-[#ffc845] group-focus-visible:border-[#ffc845]">
                      <Plus size={28} />
                    </span>
                    <span className="text-[13px] text-white/80">Your story</span>
                  </Link>
                </li>
                {(loading ? [] : latest).map((post, i) => (
                  <li key={post.id} className="shrink-0">
                    <button
                      onClick={() => setViewerAt(i)}
                      className="group flex w-[88px] flex-col items-center gap-2 focus-visible:outline-none"
                      aria-label={`Watch ${post.author_name}'s story`}
                    >
                      <span
                        className="rounded-full p-[3px] transition-transform group-hover:scale-105 group-focus-visible:scale-105"
                        style={{
                          background: `conic-gradient(from 200deg, ${categoryColor(post.category)}, #037ef3, #ffc845, ${categoryColor(post.category)})`,
                        }}
                      >
                        <span className="block rounded-full border-[3px] border-[#10213f]">
                          {post.author_avatar_url ? (
                            <img
                              src={post.author_avatar_url}
                              alt=""
                              className="size-[72px] rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex size-[72px] items-center justify-center rounded-full bg-white/10 text-[22px] font-bold">
                              {post.author_name.charAt(0)}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="w-full truncate text-center text-[13px] text-white/90">
                        {post.author_name.split(' ')[0]}
                      </span>
                    </button>
                  </li>
                ))}
                {loading &&
                  [0, 1, 2, 3, 4].map((i) => (
                    <li
                      key={i}
                      className="size-[84px] shrink-0 animate-pulse rounded-full bg-white/10"
                    />
                  ))}
              </ul>
            </div>
            <StoryGlobe
              posts={latest}
              onOpen={(post) => setViewerAt(latest.findIndex((p) => p.id === post.id))}
              homeCount={home.length}
              onHome={() =>
                document
                  .getElementById('home-journey')
                  ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
              }
            />
          </div>
        </div>
      </section>

      {/* ══ AIESEC JOURNEYS AT HOME ══ */}
      {!loading && home.length > 0 && <HomeJourney posts={home} />}

      {/* ══ FILTERS ══ */}
      <section className="border-b border-[#e1e9f5] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-10">
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:pb-0"
            role="tablist"
            aria-label="Story topics"
          >
            {STORY_CHAPTERS.map((c) => {
              const active = chapter === c
              const color = c === 'All' ? '#10213f' : categoryColor(c)
              return (
                <button
                  key={c}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setChapter(c)}
                  className="focus-visible:outline-brand flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2"
                  style={
                    active
                      ? { background: color, borderColor: color, color: 'white' }
                      : { borderColor: '#d7e3f4', color: '#10213f' }
                  }
                >
                  {c !== 'All' && (
                    <span
                      className="size-2 rounded-full"
                      style={{ background: active ? 'white' : color }}
                    />
                  )}
                  {c === 'All' ? 'All stories' : c}
                </button>
              )
            })}
          </div>
          <label className="relative block md:w-[280px]">
            <span className="sr-only">Search stories</span>
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#10213f]/40"
            />
            <input
              type="search"
              placeholder="Search by title or author"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="focus:border-brand focus:ring-brand/20 h-10 w-full rounded-full border border-[#d7e3f4] bg-[#f6f9fe] pr-4 pl-10 text-[16px] text-[#10213f] placeholder:text-[#10213f]/45 focus:ring-2 focus:outline-none md:text-[14px]"
            />
          </label>
        </div>
      </section>

      {/* ══ STORY WALL ══ */}
      <section className="bg-[#f3f7fd] px-6 pt-12 pb-20 md:px-10">
        <div className="mx-auto max-w-[1200px]">
          {loading ? (
            <div className="grid auto-rows-[260px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`animate-pulse rounded-[14px] bg-white ${i === 0 ? 'row-span-2 sm:col-span-2' : ''}`}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mx-auto max-w-[460px] py-16 text-center">
              <p className="font-display text-[26px] font-semibold text-[#10213f]">
                Nothing here yet
              </p>
              <p className="mt-2 text-[15px] text-[#10213f]/70">
                No stories match that search. Clear it, or be the first to write one on this topic.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => {
                    setChapter('All')
                    setSearchTerm('')
                  }}
                  className="rounded-full border border-[#d7e3f4] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#10213f]"
                >
                  Show all stories
                </button>
                <Link
                  to="/blog/submit"
                  className="bg-brand rounded-full px-5 py-2.5 text-[14px] font-semibold text-white"
                >
                  Write your story
                </Link>
              </div>
            </div>
          ) : (
            <motion.div
              layout
              className="grid grid-flow-dense auto-rows-[260px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((post, i) => {
                  const v = variantFor(i)
                  return (
                    <motion.div
                      key={post.id}
                      layout
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ duration: 0.3 }}
                      className={SPAN[v]}
                    >
                      <Tilt className="size-full rounded-[14px]">
                        <StoryCard post={post} variant={v} />
                      </Tilt>
                    </motion.div>
                  )
                })}
                {chapter === 'All' && !searchTerm && (
                  <motion.div key="write-tile" layout className="sm:col-span-2">
                    <Link
                      to="/blog/submit"
                      className="group flex size-full flex-col justify-between rounded-[14px] border-2 border-dashed border-[#10213f]/25 bg-white p-6 transition-colors hover:border-[#037ef3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#037ef3]"
                    >
                      <span className="flex size-12 items-center justify-center rounded-full bg-[#ffc845] text-[#10213f]">
                        <Plus size={22} />
                      </span>
                      <div>
                        <p className="font-display text-[26px] leading-[1.1] font-semibold text-[#10213f]">
                          This spot is saved for your story.
                        </p>
                        <p className="mt-2 text-[14px] text-[#10213f]/65 group-hover:text-[#037ef3]">
                          Write your story
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {!loading && filtered.length > 0 && (
            <p className="mt-6 text-[13px] text-[#10213f]/55">
              {filtered.length} {filtered.length === 1 ? 'story' : 'stories'}, newest first. Latest
              on {formatStoryDate(filtered[0], 'long')}.
            </p>
          )}
        </div>
      </section>

      {/* ══ WRITE ══ */}
      <section className="bg-[#10213f] px-6 py-20 text-white md:px-10">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <h2 className="font-display text-[36px] leading-[1.08] font-bold md:text-[48px]">
              Everyone here has one story worth telling.
            </h2>
            <p className="mt-4 max-w-[480px] text-[16px] leading-[1.7] text-white/70">
              You don't need to be a writer. Pick one moment, tell it honestly, and our team will
              help with editing and photos before it goes live.
            </p>
            <Link
              to="/blog/submit"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#ffc845] px-7 py-3.5 text-[15px] font-semibold text-[#10213f] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc845]"
            >
              <PenLine size={17} />
              Write your story
            </Link>
          </div>
          <ul className="grid gap-3">
            <li className="text-[14px] text-white/60">Stuck on how to start? Try one of these:</li>
            {WRITING_PROMPTS.map((prompt, i) => (
              <li key={prompt}>
                <Link
                  to="/blog/submit"
                  className="flex items-center gap-4 rounded-[12px] border border-white/15 bg-white/5 p-5 text-[16px] transition-colors hover:border-[#ffc845] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ffc845]"
                  style={{ marginLeft: `${i * 24}px` }}
                >
                  <PenLine size={18} className="shrink-0 text-[#ffc845]" />
                  {prompt}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <AnimatePresence>
        {viewerAt !== null && latest.length > 0 && (
          <StoryViewer posts={latest} startIndex={viewerAt} onClose={() => setViewerAt(null)} />
        )}
      </AnimatePresence>
    </>
  )
}

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { DoorOpen, PenLine, Search } from 'lucide-react'
import type { BlogPost } from '../lib/database.types'
import { useBlogPosts } from '../hooks/useBlogPosts'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { StoryViewer } from '../components/blog/StoryViewer'
import { StoryGlobe } from '../components/blog/StoryGlobe'
import { ExhibitionHall } from '../components/blog/ExhibitionHall'
import { WriteDrawer } from '../components/blog/WriteDrawer'
import { groupByDestination } from '../components/blog/destinations'
import {
  STORY_CHAPTERS,
  categoryColor,
  formatStoryDate,
  sortStories,
} from '../components/blog/storyUtils'

const VIEW_KEY = 'cs-hall-view'
const readListMode = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list'
  } catch {
    return false
  }
}

function StoryCard({ post }: { post: BlogPost }) {
  const color = categoryColor(post.category)
  return (
    <Link
      to={`/blog/${post.id}`}
      className="group block overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgba(11,26,51,.06),0_20px_40px_-28px_rgba(11,26,51,.45)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_1px_2px_rgba(11,26,51,.06),0_28px_50px_-26px_rgba(11,26,51,.55)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#037ef3]"
    >
      <span className="block aspect-[4/3] overflow-hidden bg-[#0b1a33]">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="block size-full bg-[linear-gradient(140deg,#037ef3,#0b1a33)]" />
        )}
      </span>
      <span className="block p-5">
        <span
          className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] uppercase"
          style={{ color }}
        >
          <span className="size-1.5 rounded-full" style={{ background: color }} />
          {post.category}
        </span>
        <span className="font-display mt-2 line-clamp-2 block text-[20px] leading-[1.2] font-semibold text-balance text-[#0b1a33]">
          {post.title}
        </span>
        <span className="mt-3 flex items-center gap-2.5 text-[13px] text-[#0b1a33]/60">
          {post.author_avatar_url && (
            <img src={post.author_avatar_url} alt="" className="size-7 rounded-full object-cover" />
          )}
          <span className="truncate">
            <span className="font-semibold text-[#0b1a33]">{post.author_name}</span> ·{' '}
            {formatStoryDate(post)}
          </span>
        </span>
      </span>
    </Link>
  )
}

export function BlogPage() {
  const [chapter, setChapter] = useState<string>('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewerAt, setViewerAt] = useState<number | null>(null)
  const { posts: allPosts, loading } = useBlogPosts()
  const reduced = useReducedMotion()
  const [listMode, setListMode] = useState(readListMode)
  const [drawer, setDrawer] = useState(false)
  const closeDrawer = useCallback(() => setDrawer(false), [])

  const latest = useMemo(() => sortStories(allPosts), [allPosts])
  // stories are numbered in the order they were published
  const numbers = useMemo(() => new Map(latest.map((p, i) => [p.id, latest.length - i])), [latest])
  const countries = useMemo(() => groupByDestination(latest).length, [latest])

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

  const changeMode = (list: boolean) => {
    setListMode(list)
    try {
      localStorage.setItem(VIEW_KEY, list ? 'list' : 'house')
    } catch {
      /* remembered for this visit only */
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  // reduced motion always gets the list: the house is all movement
  const house = !reduced && !listMode

  return (
    <>
      {/* ══ THE STORY HOUSE, OR THE SAME STORIES AS A LIST ══ */}
      {house && !loading ? (
        <ExhibitionHall
          posts={latest}
          numbers={numbers}
          onList={() => changeMode(true)}
          onWrite={() => setDrawer(true)}
        />
      ) : (
        <section className="bg-[#f5f7fb] px-6 pt-32 pb-20 md:px-10 md:pt-36">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[12px] font-bold tracking-[0.24em] text-[#037ef3] uppercase">
                  AIESEC in Colombo South
                </p>
                <h1 className="font-display mt-2 text-[40px] leading-[1.02] font-bold tracking-[-0.02em] text-[#0b1a33] md:text-[56px]">
                  The Story House
                </h1>
                {!reduced && (
                  <button
                    type="button"
                    onClick={() => changeMode(false)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#037ef3] px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#037ef3]"
                  >
                    <DoorOpen size={15} /> Step inside the house
                  </button>
                )}
              </div>
              <label className="relative block w-full md:w-[300px]">
                <span className="sr-only">Search stories</span>
                <Search
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#0b1a33]/40"
                />
                <input
                  type="search"
                  placeholder="Search by title or name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 w-full rounded-full border border-[#0b1a33]/10 bg-white pr-4 pl-10 text-[16px] text-[#0b1a33] placeholder:text-[#0b1a33]/40 focus:border-[#037ef3] focus:ring-2 focus:ring-[#037ef3]/20 focus:outline-none md:text-[14px]"
                />
              </label>
            </div>

            <div
              className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-1"
              role="tablist"
              aria-label="Story topics"
            >
              {STORY_CHAPTERS.map((c) => {
                const active = chapter === c
                const color = c === 'All' ? '#037ef3' : categoryColor(c)
                return (
                  <button
                    key={c}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setChapter(c)}
                    className="flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[#037ef3]"
                    style={
                      active
                        ? { background: color, borderColor: color, color: 'white' }
                        : {
                            borderColor: 'rgba(11,26,51,.12)',
                            background: 'white',
                            color: '#0b1a33',
                          }
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

            {loading ? (
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="aspect-[4/5] animate-pulse rounded-[18px] bg-white" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="mx-auto max-w-[440px] py-20 text-center">
                <p className="font-display text-[26px] font-semibold text-[#0b1a33]">
                  No stories match that
                </p>
                <p className="mt-2 text-[15px] text-[#0b1a33]/65">
                  Clear the search, or be the first to write about it.
                </p>
                <button
                  onClick={() => {
                    setChapter('All')
                    setSearchTerm('')
                  }}
                  className="mt-6 rounded-full border border-[#0b1a33]/15 bg-white px-5 py-2.5 text-[14px] font-semibold text-[#0b1a33]"
                >
                  Show every story
                </button>
              </div>
            ) : (
              <motion.div layout className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {filtered.map((post) => (
                    <motion.div
                      key={post.id}
                      layout
                      initial={reduced ? false : { opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.35 }}
                    >
                      <StoryCard post={post} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>
      )}

      {/* ══ WHERE WE WENT ══ */}
      <section className="relative overflow-hidden bg-[#0b1a33] px-6 py-20 text-white md:px-10 md:py-24">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-[#037ef3]/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
          <div className="max-w-[520px]">
            <p className="text-[12px] font-bold tracking-[0.24em] text-[#7cc0ff] uppercase">
              {loading ? 'Around the world' : `${countries} countries and counting`}
            </p>
            <h2 className="font-display mt-3 text-[38px] leading-[1.05] font-bold tracking-[-0.02em] md:text-[52px]">
              Where our members went.
            </h2>
            <p className="mt-5 text-[16px] leading-[1.75] text-white/70">
              Every pin is someone from Colombo South who packed a bag and went. Spin the globe and
              tap a face to hear their story in under a minute.
            </p>
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#ffc845] px-6 py-3.5 text-[15px] font-semibold text-[#0b1a33] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc845]"
            >
              <PenLine size={17} />
              Write your story
            </button>
          </div>
          <StoryGlobe
            posts={latest}
            onOpen={(post) => setViewerAt(latest.findIndex((p) => p.id === post.id))}
          />
        </div>
      </section>

      <WriteDrawer open={drawer} onClose={closeDrawer} />

      <AnimatePresence>
        {viewerAt !== null && latest.length > 0 && (
          <StoryViewer posts={latest} startIndex={viewerAt} onClose={() => setViewerAt(null)} />
        )}
      </AnimatePresence>
    </>
  )
}

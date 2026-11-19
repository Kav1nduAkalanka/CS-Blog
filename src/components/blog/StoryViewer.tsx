import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pause,
  PenLine,
  Play,
  Share2,
  X,
} from 'lucide-react'
import type { BlogPost } from '../../lib/database.types'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import {
  categoryColor,
  formatStoryDate,
  readReactions,
  REACTION_KEY,
  REACTIONS,
  shareStory,
  storyHighlights,
} from './storyUtils'

/* ─── Slides ─── */

type Slide =
  | { kind: 'cover'; image: string | null }
  | { kind: 'words'; text: string; image: string | null }
  | { kind: 'photo'; image: string; caption: string }
  | { kind: 'quote'; text: string }
  | { kind: 'ask' }
  | { kind: 'end'; image: string | null }

function buildSlides(post: BlogPost): Slide[] {
  const { photos, quote } = storyHighlights(post.content)
  const slides: Slide[] = [{ kind: 'cover', image: post.cover_image_url }]
  if (post.excerpt) slides.push({ kind: 'words', text: post.excerpt, image: post.cover_image_url })
  if (photos[0]) slides.push({ kind: 'photo', image: photos[0].src, caption: photos[0].alt })
  if (quote) slides.push({ kind: 'quote', text: quote })
  if (photos[1]) slides.push({ kind: 'photo', image: photos[1].src, caption: photos[1].alt })
  slides.push({ kind: 'ask' })
  slides.push({ kind: 'end', image: post.cover_image_url })
  return slides
}

/** Longer text gets longer on screen. */
function slideDuration(slide: Slide) {
  if (slide.kind === 'words' || slide.kind === 'quote') {
    return Math.max(5500, slide.text.split(/\s+/).length * 240 + 2500)
  }
  return 5500
}

type Particle = { id: number; emoji: string; x: number; y: number; drift: number; big?: boolean }

/* ─── Word-by-word text ─── */

function Words({
  text,
  className,
  delay = 0.15,
}: {
  text: string
  className?: string
  delay?: number
}) {
  const reduced = useReducedMotion()
  return (
    <p className={className}>
      {text.split(/\s+/).map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="mr-[0.25em] inline-block"
          initial={reduced ? false : { opacity: 0, y: '0.45em', filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: delay + i * 0.06, duration: 0.4 }}
        >
          {w}
        </motion.span>
      ))}
    </p>
  )
}

/* ─── Cube turn between stories ─── */

// dir is 0 for the story the viewer opens on, so it starts at rest without
// AnimatePresence initial={false}, which would also block entry animations of
// everything mounted inside that story later (reactions, question card).
const cube: Variants = {
  enter: (d: number) => ({ '--turn': `${d * 90}deg`, opacity: 1 }),
  center: { '--turn': '0deg', opacity: 1 },
  exit: (d: number) => ({ '--turn': `${d * -90}deg`, opacity: 0.6 }),
}
const fade: Variants = {
  enter: (d: number) => ({ opacity: d === 0 ? 1 : 0 }),
  center: { opacity: 1 },
  exit: { opacity: 0 },
}

/* ─── Viewer ─── */

interface StoryViewerProps {
  posts: BlogPost[]
  startIndex: number
  onClose: () => void
}

export function StoryViewer({ posts, startIndex, onClose }: StoryViewerProps) {
  const reduced = useReducedMotion()
  const navigate = useNavigate()

  const [storyIdx, setStoryIdx] = useState(startIndex)
  const [dir, setDir] = useState(0)
  const [slideIdx, setSlideIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [holding, setHolding] = useState(false)
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [reactions, setReactions] = useState<Record<string, string>>(readReactions)
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'later'>>({})
  const [particles, setParticles] = useState<Particle[]>([])
  const [toast, setToast] = useState('')
  const [half, setHalf] = useState(220)

  const frameRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; held: boolean; timer: number } | null>(null)
  const lastTap = useRef(0)
  const tapTimer = useRef(0)
  const particleId = useRef(0)

  const post = posts[storyIdx]
  const slides = useMemo(() => buildSlides(post), [post])
  const slide = slides[slideIdx]
  const color = categoryColor(post.category)
  const duration = slideDuration(slide)
  const waits = slide.kind === 'end' || (slide.kind === 'ask' && !answers[post.id])

  /* navigation */
  const goStory = useCallback(
    (to: number) => {
      if (to < 0) {
        setSlideIdx(0)
        setElapsed(0)
        return
      }
      if (to >= posts.length) return onClose()
      setDir(to > storyIdx ? 1 : -1)
      setToast('')
      setStoryIdx(to)
      setSlideIdx(0)
      setElapsed(0)
    },
    [posts.length, onClose, storyIdx],
  )

  const next = useCallback(() => {
    setElapsed(0)
    if (slideIdx < slides.length - 1) setSlideIdx((s) => s + 1)
    else goStory(storyIdx + 1)
  }, [slideIdx, slides.length, storyIdx, goStory])

  const prev = useCallback(() => {
    setElapsed(0)
    if (slideIdx > 0) setSlideIdx((s) => s - 1)
    else goStory(storyIdx - 1)
  }, [slideIdx, storyIdx, goStory])

  const openFull = useCallback(() => {
    onClose()
    navigate(`/blog/${post.id}`)
  }, [navigate, onClose, post.id])

  /* timer */
  const elapsedRef = useRef(0)
  const nextRef = useRef(next)
  useEffect(() => {
    nextRef.current = next
  }, [next])
  useEffect(() => {
    elapsedRef.current = 0
  }, [storyIdx, slideIdx])
  useEffect(() => {
    if (paused || holding || waits) return
    const t = setInterval(() => {
      elapsedRef.current += 100
      if (elapsedRef.current >= duration) nextRef.current()
      else setElapsed(elapsedRef.current)
    }, 100)
    return () => clearInterval(t)
  }, [paused, holding, waits, duration, storyIdx, slideIdx])

  /* keyboard + scroll lock */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowDown') goStory(storyIdx + 1)
      else if (e.key === 'ArrowUp') goStory(storyIdx - 1)
      else if (e.key === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [next, prev, goStory, storyIdx, onClose])

  /* cube depth follows the frame width */
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setHalf(entry.contentRect.width / 2))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* reactions */
  const burst = (emoji: string, x: number, y: number, count = 7) => {
    const fresh: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: ++particleId.current,
      emoji,
      x: x + (Math.random() - 0.5) * 40,
      y,
      drift: (Math.random() - 0.5) * 140,
      big: i === 0 && count > 1,
    }))
    setParticles((p) => [...p, ...fresh])
  }

  const react = (emoji: string, x?: number, y?: number) => {
    const r = frameRef.current?.getBoundingClientRect()
    burst(emoji, x ?? (r ? r.width / 2 : 200), y ?? (r ? r.height - 110 : 600))
    const updated = { ...reactions, [post.id]: emoji }
    setReactions(updated)
    try {
      localStorage.setItem(REACTION_KEY, JSON.stringify(updated))
    } catch {
      /* storage unavailable: keep it for this visit only */
    }
    setToast(`You reacted ${emoji} to ${post.author_name.split(' ')[0]}'s story`)
    window.setTimeout(() => setToast(''), 1800)
  }

  const answer = (choice: 'yes' | 'later', e: ReactMouseEvent) => {
    const r = frameRef.current?.getBoundingClientRect()
    burst(
      choice === 'yes' ? '✈️' : '🌱',
      r ? e.clientX - r.left : 200,
      r ? e.clientY - r.top : 500,
      10,
    )
    setAnswers((a) => ({ ...a, [post.id]: choice }))
  }

  /* gestures: tap, double-tap, hold, swipe */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const timer = window.setTimeout(() => {
      if (gesture.current) {
        gesture.current.held = true
        setHolding(true)
      }
    }, 220)
    gesture.current = { x: e.clientX, y: e.clientY, held: false, timer }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      window.clearTimeout(g.timer)
      setDrag({ x: dx, y: dy })
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    setHolding(false)
    setDrag({ x: 0, y: 0 })
    if (!g) return
    window.clearTimeout(g.timer)
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y

    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy))
      return goStory(storyIdx + (dx < 0 ? 1 : -1))
    if (dy > 100) return onClose()
    if (dy < -90) return openFull()
    if (g.held || Math.abs(dx) > 8 || Math.abs(dy) > 8) return

    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const now = Date.now()
    if (now - lastTap.current < 280) {
      window.clearTimeout(tapTimer.current)
      lastTap.current = 0
      react('❤️', x, y)
      return
    }
    lastTap.current = now
    const goBack = x < r.width / 3
    tapTimer.current = window.setTimeout(() => (goBack ? prev() : next()), 240)
  }

  const onShare = async () => {
    const r = await shareStory(post)
    if (r === 'copied') {
      setToast('Link copied')
      window.setTimeout(() => setToast(''), 1800)
    }
  }

  const chromeHidden = holding && !waits
  const bg = 'image' in slide ? slide.image : null
  const myReaction = reactions[post.id]
  const answered = answers[post.id]
  const prevPost = posts[storyIdx - 1]
  const nextPost = posts[storyIdx + 1]
  const dragStyle = {
    transform: `translate3d(${drag.x * 0.25}px, ${Math.max(drag.y, 0) * 0.6}px, 0) scale(${1 - Math.max(drag.y, 0) / 1600})`,
    transition: drag.x || drag.y ? 'none' : 'transform .35s cubic-bezier(.22,1,.36,1)',
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071224]/95 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Story by ${post.author_name}: ${post.title}`}
    >
      {/* neighbouring stories, desktop */}
      {[
        { p: prevPost, side: 'left' as const, to: storyIdx - 1 },
        { p: nextPost, side: 'right' as const, to: storyIdx + 1 },
      ].map(
        ({ p, side, to }) =>
          p && (
            <button
              key={`${side}-${p.id}`}
              onClick={() => goStory(to)}
              className={`absolute top-1/2 hidden h-[340px] w-[190px] -translate-y-1/2 overflow-hidden rounded-[12px] opacity-50 transition-opacity hover:opacity-90 focus-visible:opacity-90 focus-visible:outline-2 focus-visible:outline-white lg:block ${
                side === 'left' ? 'left-[calc(50%-470px)]' : 'right-[calc(50%-470px)]'
              }`}
              aria-label={`${side === 'left' ? 'Previous' : 'Next'} story by ${p.author_name}`}
            >
              {p.cover_image_url && (
                <img src={p.cover_image_url} alt="" className="size-full object-cover" />
              )}
              <span className="absolute inset-0 bg-[#071224]/45" />
              <span className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 text-white">
                {p.author_avatar_url && (
                  <img
                    src={p.author_avatar_url}
                    alt=""
                    className="size-14 rounded-full border-[3px] object-cover"
                    style={{ borderColor: categoryColor(p.category) }}
                  />
                )}
                <span className="text-[14px] font-semibold">{p.author_name}</span>
              </span>
            </button>
          ),
      )}

      <button
        onClick={prev}
        className="absolute left-[calc(50%-272px)] hidden size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white md:flex"
        aria-label="Previous"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        onClick={next}
        className="absolute right-[calc(50%-272px)] hidden size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white md:flex"
        aria-label="Next"
      >
        <ChevronRight size={22} />
      </button>

      {/* the phone-shaped frame */}
      <div
        ref={frameRef}
        className="relative h-svh w-full [perspective:1400px] md:h-[min(90svh,800px)] md:w-[440px]"
        style={dragStyle}
      >
        <AnimatePresence custom={dir}>
          <motion.div
            key={post.id}
            custom={dir}
            variants={reduced ? fade : cube}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0.2 : 0.55, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 overflow-hidden bg-[#10213f] [backface-visibility:hidden] md:rounded-[16px]"
            style={{
              transform: reduced
                ? undefined
                : `translateZ(-${half}px) rotateY(var(--turn, 0deg)) translateZ(${half}px)`,
            }}
          >
            {/* background */}
            <AnimatePresence initial={false}>
              <motion.div
                key={slideIdx}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45 }}
              >
                {slide.kind === 'quote' || slide.kind === 'ask' ? (
                  <motion.div
                    className="size-full"
                    style={{
                      background:
                        slide.kind === 'quote'
                          ? `radial-gradient(120% 80% at 20% 10%, ${color}, #10213f)`
                          : `radial-gradient(120% 90% at 80% 0%, #037ef3, #10213f 70%)`,
                    }}
                    animate={reduced ? undefined : { backgroundPosition: ['0% 0%', '100% 100%'] }}
                  />
                ) : bg ? (
                  <motion.img
                    src={bg}
                    alt=""
                    draggable={false}
                    className={`size-full object-cover ${slide.kind === 'words' || slide.kind === 'end' ? 'blur-md brightness-[.45]' : ''}`}
                    initial={{ scale: 1.15 }}
                    animate={
                      reduced
                        ? { scale: 1.15 }
                        : { scale: 1.02, x: slide.kind === 'photo' ? ['0%', '-3%'] : 0 }
                    }
                    transition={{ duration: duration / 1000, ease: 'linear' }}
                  />
                ) : (
                  <div className="size-full bg-[linear-gradient(160deg,#037ef3,#10213f)]" />
                )}
              </motion.div>
            </AnimatePresence>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(7,18,36,.7),transparent_20%,transparent_55%,rgba(7,18,36,.9))]" />

            {/* gesture surface */}
            <div
              className="absolute inset-0 z-10 touch-none select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                gesture.current = null
                setHolding(false)
                setDrag({ x: 0, y: 0 })
              }}
              aria-hidden="true"
            />

            {/* chrome: progress + header */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 transition-opacity duration-200"
              style={{ opacity: chromeHidden ? 0 : 1 }}
            >
              <div className="flex gap-1">
                {slides.map((_, i) => (
                  <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
                      style={{
                        width:
                          i < slideIdx
                            ? '100%'
                            : i === slideIdx
                              ? `${waits ? 100 : (elapsed / duration) * 100}%`
                              : '0%',
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className="rounded-full p-[2px]"
                  style={{ background: `conic-gradient(${color}, #037ef3, #ffc845, ${color})` }}
                >
                  {post.author_avatar_url ? (
                    <img
                      src={post.author_avatar_url}
                      alt=""
                      className="size-9 rounded-full border-2 border-[#10213f] object-cover"
                    />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-full bg-[#10213f] text-[14px] font-bold text-white">
                      {post.author_name.charAt(0)}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1 text-white">
                  <p className="truncate text-[14px] font-semibold">{post.author_name}</p>
                  <p className="truncate text-[12px] text-white/70">
                    {post.category}, {formatStoryDate(post)}
                  </p>
                </div>
                <button
                  onClick={() => setPaused((p) => !p)}
                  className="pointer-events-auto flex size-10 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
                  aria-label={paused ? 'Play' : 'Pause'}
                >
                  {paused ? <Play size={18} /> : <Pause size={18} />}
                </button>
                <button
                  onClick={onClose}
                  className="pointer-events-auto flex size-10 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
                  aria-label="Close stories"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* slide content */}
            <div className="pointer-events-none absolute inset-0 z-[15] flex flex-col justify-end px-6 pt-28 pb-40 text-white">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${post.id}-${slideIdx}`}
                  className="flex h-full flex-col justify-end"
                  initial={reduced ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}
                >
                  {slide.kind === 'cover' && (
                    <>
                      <motion.span
                        className="inline-flex -rotate-3 self-start rounded-[8px] px-3 py-1.5 text-[13px] font-bold shadow-lg"
                        style={{ background: color }}
                        initial={reduced ? false : { scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: -3 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.25 }}
                      >
                        {post.category}
                      </motion.span>
                      <Words
                        text={post.title}
                        className="font-display mt-4 text-[32px] leading-[1.08] font-bold"
                        delay={0.35}
                      />
                      <p className="mt-3 text-[14px] text-white/75">
                        {post.read_time} min read. Tap to keep going.
                      </p>
                    </>
                  )}
                  {slide.kind === 'words' && (
                    <Words
                      text={slide.text}
                      className="font-display my-auto text-[24px] leading-[1.38] font-medium"
                    />
                  )}
                  {slide.kind === 'quote' && (
                    <div className="my-auto">
                      <motion.span
                        className="font-display block text-[130px] leading-[0.6] text-white/40"
                        initial={reduced ? false : { scale: 0.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                        aria-hidden="true"
                      >
                        “
                      </motion.span>
                      <Words
                        text={slide.text}
                        className="font-display text-[29px] leading-[1.2] font-semibold"
                        delay={0.3}
                      />
                      <p className="mt-5 text-[14px] text-white/75">{post.author_name}</p>
                    </div>
                  )}
                  {slide.kind === 'photo' && slide.caption && (
                    <motion.p
                      className="max-w-[320px] -rotate-1 self-start rounded-[10px] bg-white px-3.5 py-2 text-[14px] font-medium text-[#10213f] shadow-xl"
                      initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.4 }}
                    >
                      {slide.caption}
                    </motion.p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* question slide (interactive) */}
            {slide.kind === 'ask' && (
              <div className="absolute inset-x-6 top-1/2 z-30 -translate-y-1/2">
                <motion.div
                  className="rounded-[18px] bg-white p-5 text-[#10213f] shadow-2xl"
                  initial={reduced ? false : { scale: 0.7, rotate: -4, opacity: 0 }}
                  animate={{ scale: 1, rotate: -1.5, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 15 }}
                >
                  <p className="font-display text-center text-[22px] leading-[1.2] font-bold">
                    Could you see yourself doing what {post.author_name.split(' ')[0]} did?
                  </p>
                  <AnimatePresence mode="wait">
                    {!answered ? (
                      <motion.div
                        key="q"
                        className="mt-5 grid gap-2.5"
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <button
                          onClick={(e) => answer('yes', e)}
                          className="bg-brand rounded-[12px] py-3.5 text-[16px] font-semibold text-white transition-transform active:scale-95"
                        >
                          Yes, I'd go
                        </button>
                        <button
                          onClick={(e) => answer('later', e)}
                          className="rounded-[12px] bg-[#eaf3fe] py-3.5 text-[16px] font-semibold text-[#10213f] transition-transform active:scale-95"
                        >
                          Maybe one day
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="a"
                        className="mt-4 text-center"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <p className="text-[15px] leading-[1.55] text-[#10213f]/75">
                          {answered === 'yes'
                            ? 'Then your story could be the next one here. Exchanges open every season.'
                            : 'Fair enough. Most people in these stories said the same thing once.'}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2.5">
                          <Link
                            to={answered === 'yes' ? '/programs/global-volunteer' : '/blog/submit'}
                            onClick={onClose}
                            className="bg-brand rounded-[12px] py-3 text-[14px] font-semibold text-white"
                          >
                            {answered === 'yes' ? 'See exchanges' : 'Share a story'}
                          </Link>
                          <button
                            onClick={next}
                            className="rounded-[12px] bg-[#eaf3fe] py-3 text-[14px] font-semibold"
                          >
                            Keep watching
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            )}

            {/* end card */}
            {slide.kind === 'end' && (
              <div className="absolute inset-x-0 bottom-0 z-30 p-6 pb-8 text-white">
                <Words
                  text="That was the short version."
                  className="font-display text-[30px] leading-[1.1] font-bold"
                />
                <p className="mt-2 text-[15px] text-white/75">
                  The full story has every chapter, photo and detail.
                </p>
                <div className="mt-6 grid gap-3">
                  <button
                    onClick={openFull}
                    className="flex items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[15px] font-semibold text-[#10213f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <BookOpen size={17} /> Read the full story
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={onShare}
                      className="flex items-center justify-center gap-2 rounded-full border border-white/40 py-3 text-[14px] font-semibold hover:bg-white/10"
                    >
                      <Share2 size={16} /> Share
                    </button>
                    <button
                      onClick={() => goStory(storyIdx + 1)}
                      className="flex items-center justify-center gap-2 rounded-full border border-white/40 py-3 text-[14px] font-semibold hover:bg-white/10"
                    >
                      {nextPost ? 'Next story' : 'Close'}
                    </button>
                  </div>
                  <Link
                    to="/blog/submit"
                    onClick={onClose}
                    className="mt-1 flex items-center justify-center gap-2 text-[14px] font-semibold text-[#ffc845]"
                  >
                    <PenLine size={15} /> Write your own
                  </Link>
                </div>
              </div>
            )}

            {/* bottom bar: swipe-up hint + reactions */}
            {slide.kind !== 'end' && (
              <div
                className="absolute inset-x-0 bottom-0 z-30 px-4 pb-5 transition-opacity duration-200"
                style={{ opacity: chromeHidden ? 0 : 1 }}
              >
                <button
                  onClick={openFull}
                  className="mx-auto mb-4 flex flex-col items-center text-[13px] font-semibold text-white"
                >
                  <motion.span
                    animate={reduced ? undefined : { y: [0, -5, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  >
                    <ChevronUp size={20} />
                  </motion.span>
                  Swipe up for the full story
                </button>
                <div className="flex items-center justify-between gap-1 rounded-full border border-white/25 bg-black/25 px-2 py-1.5 backdrop-blur-md">
                  {REACTIONS.map((emoji) => (
                    <motion.button
                      key={emoji}
                      onClick={() => react(emoji)}
                      whileTap={{ scale: 1.5 }}
                      className={`flex size-11 items-center justify-center rounded-full text-[22px] transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                        myReaction === emoji ? 'bg-white/25' : 'hover:bg-white/10'
                      }`}
                      aria-label={`React with ${emoji}`}
                      aria-pressed={myReaction === emoji}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* floating reactions */}
            <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
              {particles.map((p) => (
                <motion.span
                  key={p.id}
                  className="absolute"
                  style={{ left: p.x, top: p.y, fontSize: p.big ? 88 : 30 }}
                  initial={{ opacity: 0, scale: 0.3, x: '-50%', y: '-50%' }}
                  animate={
                    p.big
                      ? {
                          opacity: [0, 1, 1, 0],
                          scale: [0.3, 1.25, 1, 1.1],
                          y: ['-50%', '-50%', '-50%', '-120%'],
                        }
                      : {
                          opacity: [0, 1, 1, 0],
                          scale: [0.4, 1.1, 1],
                          x: ['-50%', `${p.drift}px`],
                          y: ['-50%', '-320px'],
                        }
                  }
                  transition={{ duration: p.big ? 0.9 : 1.5, ease: 'easeOut' }}
                  onAnimationComplete={() =>
                    setParticles((all) => all.filter((q) => q.id !== p.id))
                  }
                >
                  {p.emoji}
                </motion.span>
              ))}
            </div>

            {/* paused badge */}
            <AnimatePresence>
              {paused && !waits && (
                <motion.div
                  className="pointer-events-none absolute top-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/45 px-3.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  Paused
                </motion.div>
              )}
            </AnimatePresence>

            {/* toast */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  className="pointer-events-none absolute inset-x-6 bottom-32 z-40 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="status"
                >
                  <span className="inline-block rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#10213f] shadow-lg">
                    {toast}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* desktop gesture hints */}
      <p className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-[12px] text-white/45 md:block">
        Arrow keys to move, space to pause, double-click to like, Esc to close
      </p>
    </motion.div>
  )
}

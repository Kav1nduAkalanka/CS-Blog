import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  ChevronDown,
  FileText,
  Footprints,
  Plane,
} from 'lucide-react'
import type { BlogPost } from '../../lib/database.types'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { ShareButtons } from './ShareButtons'
import { distanceKm, HOME, storyDestination, type Place } from './destinations'
import {
  categoryColor,
  formatStoryDate,
  readReactions,
  REACTION_KEY,
  REACTIONS,
  type StoryChapter,
} from './storyUtils'

/* The story page as a journey: a ticket that takes off, the opening line on
   its own, then each chapter as an opening shot (its photo opening up to fill
   the screen) followed by the chapter told beside a pinned photo that changes
   as the story reaches each new picture. The paragraph being read is lit, the
   rest wait in the shade. Quotes stop the flow and take the whole screen. A
   route along the bottom fills as you read, and the story ends in a landing.
   Everything comes from the post as written: chapters from headings, photos
   and captions from the images in each chapter. */

/* ─── Turning chapter HTML into scenes ─── */

type Item =
  | { kind: 'para'; html: string }
  | { kind: 'photo'; src: string; alt: string }
  | { kind: 'embed'; html: string }

type Segment =
  | { kind: 'flow'; lead: string | null; items: Item[] }
  | { kind: 'quote'; text: string; image: string | null }

interface Scene {
  id: string
  label: string
  number: number | null
  title: string | null
  image: string | null
  segments: Segment[]
}

const escapeText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const unquote = (s: string) =>
  s
    .trim()
    .replace(/^["“]\s*/, '')
    .replace(/\s*["”]$/, '')

/** Reads (already sanitised) chapter HTML into a list of pieces. */
function readPieces(html: string) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  const pieces: (Item | { kind: 'quote'; text: string })[] = []
  for (const node of Array.from(root?.childNodes ?? [])) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.trim()
      if (t) pieces.push({ kind: 'para', html: `<p>${escapeText(t)}</p>` })
      continue
    }
    if (!(node instanceof Element)) continue
    const img =
      node.tagName === 'IMG'
        ? node
        : node.children.length === 1 && !node.textContent?.trim()
          ? node.querySelector(':scope > img')
          : null
    if (img) {
      const src = img.getAttribute('src')
      if (src) pieces.push({ kind: 'photo', src, alt: img.getAttribute('alt') ?? '' })
    } else if (node.tagName === 'BLOCKQUOTE' || node.classList.contains('blog-pull-quote')) {
      pieces.push({ kind: 'quote', text: unquote(node.textContent ?? '') })
    } else if (node.tagName === 'IFRAME' || node.querySelector('iframe')) {
      pieces.push({ kind: 'embed', html: node.outerHTML })
    } else {
      pieces.push({ kind: 'para', html: node.outerHTML })
    }
  }
  return pieces
}

/** Takes the first sentence of the intro out, to be shown on its own. */
function splitOpening(intro: string, fallback: string): { opening: string; rest: string } {
  const doc = new DOMParser().parseFromString(`<div>${intro}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  const first = root?.firstElementChild
  const sentence = (s: string) => /^[\s\S]+?[.!?](?=\s|$)/.exec(s.trim())?.[0] ?? s.trim()

  if (root && first?.tagName === 'P' && first.children.length === 0 && first.textContent?.trim()) {
    const all = first.textContent.trim()
    const opening = sentence(all)
    const left = all.slice(opening.length).trim()
    if (left) first.textContent = left
    else first.remove()
    return { opening, rest: root.innerHTML }
  }
  return { opening: sentence(fallback), rest: intro }
}

function buildScenes(
  intro: string,
  chapters: StoryChapter[],
  excerpt: string,
  cover: string | null,
) {
  const { opening, rest } = splitOpening(intro, excerpt)
  // the photo on screen so far; a chapter with no photo of its own keeps it
  let current = cover

  const toScene = (html: string, base: Omit<Scene, 'image' | 'segments'>): Scene => {
    const pieces = readPieces(html)
    const firstPhoto = pieces.findIndex((p) => p.kind === 'photo')
    // the chapter's first photo is its opening shot, so it is not repeated in the text
    const image =
      firstPhoto >= 0 ? (pieces.splice(firstPhoto, 1)[0] as { src: string }).src : current
    current = image
    const segments: Segment[] = []
    let flow: Item[] = []
    let lead = image
    const close = () => {
      if (flow.length) segments.push({ kind: 'flow', lead, items: flow })
      flow = []
      lead = current
    }
    for (const p of pieces) {
      if (p.kind === 'quote') {
        close()
        segments.push({ kind: 'quote', text: p.text, image: current })
        continue
      }
      if (p.kind === 'photo') current = p.src
      flow.push(p)
    }
    close()
    return { ...base, image, segments }
  }

  const scenes: Scene[] = []
  if (rest.trim()) {
    const s = toScene(rest, {
      id: 'prologue',
      label: chapters.length ? 'Before it began' : 'The story',
      number: null,
      title: null,
    })
    if (s.segments.length) scenes.push(s)
  }
  chapters.forEach((c, i) =>
    scenes.push(
      toScene(c.html, { id: c.id, label: `Chapter ${i + 1}`, number: i + 1, title: c.title }),
    ),
  )
  return { opening, scenes, lastImage: current }
}

/* ─── Pieces ─── */

/** A clamped linear mapping. Written as a function on purpose: motion runs
    plain range-to-range maps on the browser's native scroll timeline, which
    measured these sticky sections wrongly (the scroll hint faded in instead
    of out). */
function useRamp(v: MotionValue<number>, [a, b]: [number, number], [from, to]: [number, number]) {
  return useTransform(v, (x) => from + (to - from) * Math.min(1, Math.max(0, (x - a) / (b - a))))
}

function Avatar({ post, size, color }: { post: BlogPost; size: string; color: string }) {
  return post.author_avatar_url ? (
    <img
      src={post.author_avatar_url}
      alt=""
      className={`${size} shrink-0 rounded-full object-cover`}
    />
  ) : (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ background: color }}
    >
      {post.author_name.charAt(0)}
    </span>
  )
}

function Ticket({
  post,
  place,
  stops,
  planeX,
}: {
  post: BlogPost
  place: Place | null
  stops: number
  planeX?: MotionValue<string>
}) {
  const from = place
    ? { name: 'Colombo', sub: 'Sri Lanka' }
    : { name: 'Day one', sub: 'Joined AIESEC' }
  const to = place
    ? { name: place.city, sub: place.country }
    : { name: 'Today', sub: 'Colombo South' }
  const Icon = place ? Plane : Footprints
  const detail = (k: string, v: ReactNode) => (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold tracking-[0.18em] text-[#10213f]/45 uppercase">
        {k}
      </dt>
      <dd className="mt-0.5 line-clamp-2 text-[14px] leading-snug font-semibold text-[#10213f]">
        {v}
      </dd>
    </div>
  )
  return (
    <div className="w-full max-w-[560px] overflow-hidden rounded-[22px] bg-white text-[#10213f] shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)] sm:grid sm:grid-cols-[minmax(0,1fr)_120px]">
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.2em] uppercase">
          <span className="text-[#037ef3]">AIESEC Colombo South</span>
          <span className="text-[#10213f]/45">{place ? 'Boarding pass' : 'Journey pass'}</span>
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,auto)_minmax(40px,1fr)_minmax(0,auto)] items-center gap-3">
          <div className="min-w-0">
            <p className="font-display truncate text-[26px] leading-none font-bold sm:text-[32px]">
              {from.name}
            </p>
            <p className="mt-1 truncate text-[12px] text-[#10213f]/55">{from.sub}</p>
          </div>
          <div className="relative h-6" aria-hidden="true">
            <span className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-[#10213f]/20" />
            <motion.span
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-1 text-[#037ef3]"
              style={{ left: planeX ?? '50%' }}
            >
              <Icon size={20} className={place ? 'rotate-45' : ''} />
            </motion.span>
          </div>
          <div className="min-w-0 text-right">
            <p className="font-display truncate text-[26px] leading-none font-bold sm:text-[32px]">
              {to.name}
            </p>
            <p className="mt-1 truncate text-[12px] text-[#10213f]/55">{to.sub}</p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {detail('Passenger', post.author_name)}
          {detail('Date', formatStoryDate(post, 'short'))}
          {detail('Stops', `${stops} ${stops === 1 ? 'chapter' : 'chapters'}`)}
        </dl>
      </div>
      {/* the stub, torn off along the dashes */}
      <div className="relative flex items-center justify-between gap-4 border-t-2 border-dashed border-[#10213f]/15 bg-[#f3f7fd] px-5 py-4 sm:flex-col sm:items-start sm:justify-center sm:border-t-0 sm:border-l-2 sm:px-4">
        <span className="absolute -top-3 -left-3 size-6 rounded-full bg-[#0b1830]" />
        <span className="absolute -top-3 -right-3 size-6 rounded-full bg-[#0b1830] sm:top-auto sm:right-auto sm:-bottom-3 sm:-left-3" />
        <dl className="flex gap-6 sm:flex-col sm:gap-3">
          {detail('Gate', 'Chapter 1')}
          {detail('Time', `${post.read_time} min`)}
        </dl>
        <span
          className="h-9 w-24 opacity-80 sm:w-full"
          style={{
            background:
              'repeating-linear-gradient(90deg,#10213f 0 2px,transparent 2px 4px,#10213f 4px 5px,transparent 5px 8px,#10213f 8px 11px,transparent 11px 13px)',
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

function Departure({
  post,
  place,
  stops,
  onPlain,
}: {
  post: BlogPost
  place: Place | null
  stops: number
  onPlain: () => void
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const planeX = useTransform(p, [0, 0.3], ['8%', '92%'])
  const ticketY = useTransform(p, [0.18, 0.48], ['0vh', '-70vh'])
  const ticketRotate = useTransform(p, [0.18, 0.48], [0, -10])
  const ticketOpacity = useRamp(p, [0.3, 0.48], [1, 0])
  const veil = useRamp(p, [0.1, 0.55], [0.82, 0.25])
  const coverScale = useTransform(p, [0, 1], [1.3, 1.05])
  const titleOpacity = useRamp(p, [0.5, 0.75], [0, 1])
  const titleY = useTransform(p, [0.5, 0.75], [50, 0])
  const hintOpacity = useRamp(p, [0, 0.08], [1, 0])
  const color = categoryColor(post.category)

  const title = (
    <>
      <span
        className="inline-block rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white"
        style={{ background: color }}
      >
        {post.category}
      </span>
      <h1 className="font-display mt-5 max-w-[900px] text-[40px] leading-[1.02] font-bold tracking-[-0.02em] text-balance text-white sm:text-[60px] lg:text-[76px]">
        {post.title}
      </h1>
      <div className="mt-6 flex items-center gap-3 text-[14px] text-white">
        <Avatar post={post} size="size-11 text-[15px] border-2 border-white/60" color={color} />
        <p>
          <span className="font-semibold">A journey by {post.author_name}</span>
          <span className="block text-white/65">
            {formatStoryDate(post, 'long')}, {post.read_time} min read
          </span>
        </p>
      </div>
    </>
  )

  return (
    <section ref={ref} className={reduced ? 'relative' : 'relative h-[260svh]'}>
      <div
        className={`overflow-hidden bg-[#0b1830] ${reduced ? 'relative min-h-svh' : 'sticky top-0 h-svh min-h-[600px]'}`}
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
        <motion.div
          className="absolute inset-0 bg-[#0b1830]"
          style={{ opacity: reduced ? 0.55 : veil }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,#0b1830_4%,rgba(11,24,48,.5)_40%,transparent_70%)]" />

        <div className="absolute inset-x-6 top-28 z-20 flex items-center justify-between gap-3 md:inset-x-10">
          <Link
            to="/blog"
            state={{ hall: true }}
            className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
          >
            <ArrowLeft size={15} />
            Story House
          </Link>
          <button
            type="button"
            onClick={onPlain}
            className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
          >
            <FileText size={15} />
            Read as article
          </button>
        </div>

        {reduced ? (
          <div className="relative z-10 mx-auto flex min-h-svh max-w-[1100px] flex-col justify-end gap-10 px-6 pt-44 pb-16 md:px-10">
            <Ticket post={post} place={place} stops={stops} />
            <div>{title}</div>
          </div>
        ) : (
          <>
            <motion.div
              className="absolute inset-0 z-10 flex items-center justify-center px-5 pt-16"
              style={{ y: ticketY, rotate: ticketRotate, opacity: ticketOpacity }}
            >
              <Ticket post={post} place={place} stops={stops} planeX={planeX} />
            </motion.div>
            <motion.div
              className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-[1100px] px-6 pb-20 md:px-10"
              style={{ opacity: titleOpacity, y: titleY }}
            >
              {title}
            </motion.div>
            <motion.div
              className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-[13px] font-semibold text-white/75"
              style={{ opacity: hintOpacity }}
              aria-hidden="true"
            >
              {place ? 'Scroll to take off' : 'Scroll to begin'}
              <motion.span
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                <ChevronDown size={22} />
              </motion.span>
            </motion.div>
          </>
        )}
      </div>
    </section>
  )
}

function Word({
  word,
  progress,
  range,
}: {
  word: string
  progress: MotionValue<number>
  range: [number, number]
}) {
  const opacity = useRamp(progress, range, [0.15, 1])
  return <motion.span style={{ opacity }}>{word} </motion.span>
}

/** The first sentence alone on a dark screen, lighting up word by word as you scroll. */
function OpeningLine({ text }: { text: string }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return null
  return (
    <section ref={ref} className={`relative bg-[#0b1830] ${reduced ? '' : 'h-[180svh]'}`}>
      <div
        className={`flex flex-col items-center justify-center px-6 text-center ${reduced ? 'min-h-[70svh] py-24' : 'sticky top-0 h-svh'}`}
      >
        <p className="text-[12px] font-semibold tracking-[0.3em] text-[#ffc845] uppercase">
          It started like this
        </p>
        <p className="font-display mt-6 max-w-[920px] text-[30px] leading-[1.2] font-semibold text-balance text-white sm:text-[44px] lg:text-[56px]">
          {reduced
            ? text
            : words.map((w, i) => (
                <Word
                  key={i}
                  word={w}
                  progress={scrollYProgress}
                  range={[(i / words.length) * 0.75, ((i + 1) / words.length) * 0.75 + 0.02]}
                />
              ))}
        </p>
      </div>
    </section>
  )
}

/** A chapter's opening shot: its photo opens up from a window to the full
    screen, with the chapter number huge behind the title. */
function ChapterOpener({ scene }: { scene: Scene }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const clipPath = useTransform(p, (v) => {
    const k = Math.max(0, 1 - v / 0.55)
    return `inset(${14 * k}% ${10 * k}% ${14 * k}% ${10 * k}% round ${28 * k}px)`
  })
  const imgScale = useRamp(p, [0, 1], [1.3, 1])
  const numY = useTransform(p, (v) => `${(0.5 - v) * 40}%`)
  const titleOpacity = useRamp(p, [0.2, 0.5], [0, 1])
  const titleY = useRamp(p, [0.2, 0.5], [40, 0])
  const number = String(scene.number ?? 0).padStart(2, '0')

  return (
    <section ref={ref} className={reduced ? 'relative' : 'relative h-[190svh]'}>
      <div className="sticky top-0 h-svh overflow-hidden bg-[#0b1830]">
        <motion.div
          className="absolute inset-0 overflow-hidden"
          style={reduced ? undefined : { clipPath }}
        >
          {scene.image ? (
            <motion.img
              src={scene.image}
              alt=""
              className="size-full object-cover"
              style={reduced ? undefined : { scale: imgScale }}
            />
          ) : (
            <div className="size-full bg-[linear-gradient(140deg,#037ef3,#10213f)]" />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(11,24,48,.35),rgba(11,24,48,.8))]" />
        </motion.div>
        <motion.span
          className="font-display pointer-events-none absolute inset-0 flex items-center justify-center text-[46vw] leading-none font-bold text-transparent select-none [-webkit-text-stroke:2px_rgba(255,255,255,.28)] lg:text-[24vw]"
          style={reduced ? undefined : { y: numY }}
          aria-hidden="true"
        >
          {number}
        </motion.span>
        <motion.div
          className="relative flex h-full flex-col items-center justify-center px-6 text-center text-white"
          style={reduced ? undefined : { opacity: titleOpacity, y: titleY }}
        >
          <p className="text-[12px] font-semibold tracking-[0.32em] text-[#ffc845] uppercase">
            {scene.label}
          </p>
          <h2 className="font-display mt-4 max-w-[1000px] text-[42px] leading-[1.02] font-bold tracking-[-0.02em] text-balance [text-shadow:0_4px_40px_rgba(0,0,0,.55)] sm:text-[64px] lg:text-[84px]">
            {scene.title}
          </h2>
        </motion.div>
      </div>
    </section>
  )
}

/** The chapter told beside a pinned photo (above it on phones). The photo
    changes when the reader reaches the next picture in the text; the
    paragraph being read is lit and the ones ahead wait in the shade. */
function Flow({
  lead,
  items,
  first,
  heading,
}: {
  lead: string | null
  items: Item[]
  first: boolean
  heading?: { label: string; title: string | null }
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.item))
        }
      },
      { rootMargin: '-52% 0px -40% 0px' },
    )
    el.querySelectorAll('[data-item]').forEach((n) => obs.observe(n))
    return () => obs.disconnect()
  }, [items])

  const media = useMemo(
    () => [
      { src: lead, alt: '' },
      ...items.flatMap((it) => (it.kind === 'photo' ? [{ src: it.src, alt: it.alt }] : [])),
    ],
    [lead, items],
  )
  // which photo is showing: the last one the reader has passed
  let shown = 0
  let ordinal = 0
  items.forEach((it, i) => {
    if (it.kind !== 'photo') return
    ordinal++
    if (i <= active) shown = ordinal
  })
  const current = media[shown]
  const lit = (i: number) => (reduced || i <= Math.max(active, 0) ? 1 : 0.25)
  const leadIndex = first ? items.findIndex((it) => it.kind === 'para') : -1

  return (
    <div
      ref={ref}
      className="relative bg-[#f6f1e7] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <div className="sticky top-0 z-10 h-[46svh] overflow-hidden bg-[#0b1830] lg:h-svh">
        {media.map((m, i) =>
          m.src ? (
            <motion.img
              key={i}
              src={m.src}
              alt={m.alt}
              className="absolute inset-0 size-full object-cover"
              initial={false}
              animate={{ opacity: i === shown ? 1 : 0, scale: i === shown || reduced ? 1 : 1.08 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : (
            <motion.div
              key={i}
              className="absolute inset-0 bg-[linear-gradient(140deg,#037ef3,#10213f)]"
              initial={false}
              animate={{ opacity: i === shown ? 1 : 0 }}
            />
          ),
        )}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(11,24,48,.85),transparent_45%)]" />
        {media.length > 1 && (
          <span className="absolute top-24 right-4 rounded-full bg-black/40 px-2.5 py-1 text-[12px] font-semibold text-white tabular-nums backdrop-blur lg:top-28 lg:right-6">
            {shown + 1} / {media.length}
          </span>
        )}
        <AnimatePresence mode="wait">
          {current.alt && (
            <motion.p
              key={shown}
              className="absolute inset-x-5 bottom-4 flex items-start gap-2 text-[14px] leading-snug font-medium text-white lg:inset-x-8 lg:bottom-8 lg:text-[16px]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
            >
              <Camera size={16} className="mt-0.5 shrink-0 text-[#ffc845]" />
              {current.alt}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="relative px-6 py-12 sm:px-10 lg:px-16 lg:py-[30svh]">
        <div className="mx-auto max-w-[560px] lg:mx-0">
          {heading && (
            <header className="mb-8 border-b border-[#10213f]/15 pb-6">
              <p className="text-[12px] font-semibold tracking-[0.28em] text-[var(--story-accent)] uppercase">
                {heading.label}
              </p>
              {heading.title && (
                <p className="font-display mt-2 text-[26px] leading-[1.15] font-bold text-balance text-[#10213f]">
                  {heading.title}
                </p>
              )}
            </header>
          )}
          {items.map((it, i) => {
            const style = { opacity: lit(i) }
            const fade = 'transition-opacity duration-500'
            if (it.kind === 'photo') {
              return (
                <p
                  key={i}
                  data-item={i}
                  style={style}
                  className={`${fade} my-10 flex items-center gap-3 text-[13px] font-semibold text-[#10213f]/60`}
                >
                  <span className="h-px w-8 bg-[#10213f]/30" />
                  <ArrowUp size={14} className="shrink-0 lg:-rotate-90" />
                  <span>{it.alt || 'A new photo'}</span>
                </p>
              )
            }
            if (it.kind === 'embed') {
              return (
                <div
                  key={i}
                  data-item={i}
                  style={style}
                  className={`${fade} story-body my-10`}
                  dangerouslySetInnerHTML={{ __html: it.html }}
                />
              )
            }
            const isLead = i === leadIndex
            return (
              <div
                key={i}
                data-item={i}
                className={`${fade} story-body mt-7 first:mt-0 ${isLead ? 'font-display font-medium text-[#10213f]' : ''}`}
                style={isLead ? { ...style, fontSize: 22, lineHeight: 1.55 } : style}
                dangerouslySetInnerHTML={{ __html: it.html }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** A quote stops the flow and takes the screen, word by word. */
function QuoteMoment({
  text,
  image,
  post,
  color,
}: {
  text: string
  image: string | null
  post: BlogPost
  color: string
}) {
  const reduced = useReducedMotion()
  const words = text.split(/\s+/)
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#0b1830] px-6 py-24">
      {image && (
        <img
          src={image}
          alt=""
          className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-md"
        />
      )}
      <motion.blockquote
        className="relative max-w-[920px] text-center"
        initial={reduced ? false : 'hidden'}
        whileInView="shown"
        viewport={{ once: true, amount: 0.5 }}
        transition={{ staggerChildren: 0.06 }}
      >
        <span
          className="font-display block text-[90px] leading-[0.5] text-[#ffc845]"
          aria-hidden="true"
        >
          “
        </span>
        <p className="font-display mt-4 text-[30px] leading-[1.18] font-semibold text-balance text-white sm:text-[44px] lg:text-[54px]">
          {words.map((w, i) => (
            <motion.span
              key={i}
              className="inline-block"
              variants={{ hidden: { opacity: 0, y: 18 }, shown: { opacity: 1, y: 0 } }}
            >
              {w}&nbsp;
            </motion.span>
          ))}
        </p>
        <footer className="mt-8 flex items-center justify-center gap-3 text-[15px] font-semibold text-white/80">
          <Avatar post={post} size="size-9 text-[13px]" color={color} />
          {post.author_name}, looking back
        </footer>
      </motion.blockquote>
    </div>
  )
}

function SceneView({
  scene,
  index,
  post,
  color,
}: {
  scene: Scene
  index: number
  post: BlogPost
  color: string
}) {
  const firstFlow = scene.segments.findIndex((seg) => seg.kind === 'flow')
  return (
    <section id={scene.id} data-scene={index} className="relative">
      {scene.title && <ChapterOpener scene={scene} />}
      {scene.segments.map((seg, i) => {
        if (seg.kind === 'quote') {
          return <QuoteMoment key={i} text={seg.text} image={seg.image} post={post} color={color} />
        }
        return (
          <Flow
            key={i}
            lead={seg.lead}
            items={seg.items}
            first={i === firstFlow}
            heading={i === firstFlow ? { label: scene.label, title: scene.title } : undefined}
          />
        )
      })}
    </section>
  )
}

/** The route along the bottom: one stop per chapter, a plane (or footsteps
    at home) moving along it as you read. */
function JourneyBar({
  scenes,
  active,
  place,
  progress,
  stops,
  visible,
  onJump,
}: {
  scenes: Scene[]
  active: number
  place: Place | null
  progress: MotionValue<number>
  stops: number[]
  visible: boolean
  onJump: (id: string) => void
}) {
  const left = useTransform(progress, (v) => `${Math.min(100, Math.max(0, v * 100))}%`)
  const width = useTransform(progress, (v) => Math.min(1, Math.max(0, v)))
  const Icon = place ? Plane : Footprints
  const current = scenes[active]
  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          aria-label="Journey"
          className="fixed right-[76px] bottom-4 left-3 z-50 rounded-[18px] border border-white/15 bg-[#0b1830]/85 px-4 pt-2.5 pb-3 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)] backdrop-blur-md sm:right-auto sm:left-1/2 sm:w-[540px] sm:-translate-x-1/2"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.3 }}
        >
          <p className="truncate text-center text-[12px] text-white/75" aria-live="polite">
            <span className="font-semibold text-[#ffc845]">{current?.label}</span>
            {current?.title && <> · {current.title}</>}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold">
            <span className="shrink-0 text-white/70">{place ? 'Colombo' : 'Day one'}</span>
            <div className="relative h-6 flex-1">
              <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.3)_0_5px,transparent_5px_10px)]" />
              <motion.span
                className="absolute top-1/2 left-0 h-[2px] w-full origin-left -translate-y-1/2 rounded-full bg-[#ffc845]"
                style={{ scaleX: width }}
              />
              {scenes.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onJump(s.id)}
                  className="absolute top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[#ffc845]"
                  style={{ left: `${(stops[i] ?? i / scenes.length) * 100}%` }}
                  aria-label={`Go to ${s.label}${s.title ? `: ${s.title}` : ''}`}
                  aria-current={i === active ? 'step' : undefined}
                >
                  <span
                    className="size-2.5 rounded-full border-2 transition-colors"
                    style={{
                      borderColor: i <= active ? '#ffc845' : 'rgba(255,255,255,.5)',
                      background: i <= active ? '#ffc845' : '#0b1830',
                    }}
                  />
                </button>
              ))}
              <motion.span
                className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_0_6px_rgba(255,200,69,.9)]"
                style={{ left }}
                aria-hidden="true"
              >
                <Icon size={18} className={place ? 'rotate-45' : ''} />
              </motion.span>
            </div>
            <span className="max-w-[90px] shrink-0 truncate text-white/70">
              {place ? place.city : 'Today'}
            </span>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  )
}

const fadeUp = {
  initial: { opacity: 0, y: 60 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.35 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
}

function Arrival({
  post,
  place,
  chapters,
  image,
  next,
}: {
  post: BlogPost
  place: Place | null
  chapters: number
  image: string | null
  next?: BlogPost
}) {
  const reduced = useReducedMotion()
  const color = categoryColor(post.category)
  const [reaction, setReaction] = useState<string | undefined>(() => readReactions()[post.id])
  const nextPlace = useMemo(() => (next ? storyDestination(next) : null), [next])
  const first = post.author_name.split(' ')[0]

  const react = (emoji: string) => {
    setReaction(emoji)
    try {
      localStorage.setItem(REACTION_KEY, JSON.stringify({ ...readReactions(), [post.id]: emoji }))
    } catch {
      /* storage unavailable: keep it for this visit only */
    }
  }

  const stats: [string, string][] = place
    ? [
        [Math.round(distanceKm(HOME, place) * 2).toLocaleString('en-US'), 'km there and back'],
        [String(chapters), chapters === 1 ? 'chapter' : 'chapters'],
        [String(post.read_time), 'minutes with ' + first],
      ]
    : [
        [String(chapters), chapters === 1 ? 'chapter' : 'chapters'],
        [String(post.read_time), 'minutes with ' + first],
        ['0', 'passports needed'],
      ]

  return (
    <section className="relative overflow-hidden bg-[#0b1830] px-6 pt-28 pb-20 text-white md:px-10">
      {image && (
        <img
          src={image}
          alt=""
          className="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-md"
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#0b1830,rgba(11,24,48,.7)_40%,#0b1830)]" />

      <div className="relative mx-auto max-w-[900px] text-center">
        <motion.p
          className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.3em] text-[#ffc845] uppercase"
          initial={reduced ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {place ? <Plane size={14} className="rotate-[135deg]" /> : <Footprints size={14} />}
          {place ? 'Landed' : 'For now'}
        </motion.p>
        <motion.h2
          className="font-display mt-4 text-[44px] leading-[1.02] font-bold tracking-[-0.02em] text-balance sm:text-[64px] lg:text-[80px]"
          {...(reduced ? {} : fadeUp)}
        >
          {place ? 'Back in Colombo.' : 'And the road goes on.'}
        </motion.h2>

        <dl className="mx-auto mt-10 grid max-w-[680px] grid-cols-3 gap-4">
          {stats.map(([n, label], i) => (
            <motion.div
              key={label}
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.12 }}
            >
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="font-display block text-[30px] leading-none font-bold sm:text-[44px]">
                  {n}
                </span>
                <span className="mt-2 block text-[13px] text-white/65">{label}</span>
              </dd>
            </motion.div>
          ))}
        </dl>

        <div className="mt-14">
          <p className="text-[15px] text-white/75">How did {first}'s journey make you feel?</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            {REACTIONS.map((emoji) => {
              const on = reaction === emoji
              return (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  whileTap={reduced ? undefined : { scale: 0.85 }}
                  animate={on && !reduced ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                  className={`flex size-12 items-center justify-center rounded-full text-[22px] transition-colors focus-visible:outline-2 focus-visible:outline-[#ffc845] ${on ? 'bg-[#ffc845]' : 'bg-white/10 hover:bg-white/20'}`}
                  aria-pressed={on}
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </motion.button>
              )
            })}
          </div>
          <p className="mt-3 h-5 text-[13px] text-white/55" aria-live="polite">
            {reaction ? `You reacted ${reaction}. Saved on this device.` : ''}
          </p>
        </div>

        <div className="mx-auto mt-12 flex max-w-[620px] flex-col items-center gap-4 rounded-[20px] bg-white p-6 text-left text-[#10213f] sm:flex-row sm:items-start">
          <Avatar post={post} size="size-16 text-[22px]" color={color} />
          <div className="min-w-0 text-center sm:text-left">
            <p className="font-display text-[22px] font-semibold">{post.author_name}</p>
            <p className="mt-1 text-[15px] leading-[1.6] text-[#10213f]/70">
              Part of the AIESEC in Colombo South community. If this journey stayed with you, pass
              it to someone who needs it.
            </p>
            <ShareButtons post={post} className="mt-4 flex-wrap justify-center sm:justify-start" />
          </div>
        </div>

        {next && (
          <Link
            to={`/blog/${next.id}`}
            className="group relative mx-auto mt-12 block max-w-[620px] overflow-hidden rounded-[20px] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffc845]"
          >
            {next.cover_image_url ? (
              <img
                src={next.cover_image_url}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
              />
            ) : (
              <span className="absolute inset-0 bg-[linear-gradient(140deg,#037ef3,#10213f)]" />
            )}
            <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,22,44,.95),rgba(10,22,44,.35))]" />
            <span className="relative flex min-h-[220px] flex-col justify-end p-6 sm:p-8">
              <span className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.25em] text-[#ffc845] uppercase">
                {nextPlace ? (
                  <>
                    Next journey: Colombo <Plane size={13} className="rotate-45" /> {nextPlace.city}
                  </>
                ) : (
                  <>
                    Next journey: here at home <Footprints size={13} />
                  </>
                )}
              </span>
              <span className="font-display mt-2 block text-[26px] leading-[1.12] font-semibold text-balance sm:text-[30px]">
                {next.title}
              </span>
              <span className="mt-3 flex items-center justify-between gap-3 text-[14px] text-white/75">
                <span className="truncate">
                  {next.author_name}, {next.read_time} min
                </span>
                <span className="flex shrink-0 items-center gap-1.5 font-semibold text-white">
                  Board now
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </span>
            </span>
          </Link>
        )}
      </div>
    </section>
  )
}

/* ─── The whole journey ─── */

export function JourneyStory({
  post,
  intro,
  chapters,
  next,
  onPlain,
}: {
  post: BlogPost
  intro: string
  chapters: StoryChapter[]
  next?: BlogPost
  onPlain: () => void
}) {
  const reduced = useReducedMotion()
  const color = categoryColor(post.category)
  const place = useMemo(() => storyDestination(post), [post])
  const { opening, scenes, lastImage } = useMemo(
    () => buildScenes(intro, chapters, post.excerpt, post.cover_image_url || null),
    [intro, chapters, post.excerpt, post.cover_image_url],
  )

  const wrapRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)
  const [stops, setStops] = useState<number[]>([])
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (v) => setVisible(v > 0.002 && v < 0.998))

  // which scene is in the middle of the screen
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.scene))
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    )
    wrap.querySelectorAll('[data-scene]').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [scenes])

  // where each scene starts along the route, as a fraction of the whole
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => {
      const total = wrap.offsetHeight - window.innerHeight
      if (total <= 0) return
      setStops(
        Array.from(wrap.querySelectorAll<HTMLElement>('[data-scene]')).map((el) =>
          Math.min(1, Math.max(0, el.offsetTop / total)),
        ),
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [scenes])

  const jump = (id: string) =>
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })

  return (
    <div className="bg-[#0b1830]" style={{ ['--story-accent' as string]: color }}>
      <Departure post={post} place={place} stops={chapters.length || 1} onPlain={onPlain} />
      <OpeningLine text={opening} />

      <div ref={wrapRef} className="relative">
        {scenes.map((scene, i) => (
          <SceneView key={scene.id} scene={scene} index={i} post={post} color={color} />
        ))}

        <JourneyBar
          scenes={scenes}
          active={active}
          place={place}
          progress={scrollYProgress}
          stops={stops}
          visible={visible}
          onJump={jump}
        />
      </div>

      <Arrival
        post={post}
        place={place}
        chapters={chapters.length || 1}
        image={lastImage}
        next={next}
      />
    </div>
  )
}

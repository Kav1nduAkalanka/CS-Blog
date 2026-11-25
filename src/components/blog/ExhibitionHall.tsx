import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { animate, useMotionValue, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { List, MoveHorizontal, Plus } from 'lucide-react'
import type { BlogPost } from '../../lib/database.types'
import { STORY_CHAPTERS, categoryColor, formatStoryDate } from './storyUtils'
import { flyIntoStory, saveHallReturn, takeHallReturn, type HallReturn } from './hallFly'
import { HouseFacade } from './HouseFacade'

/* The exhibition hall: one long, curving, warm-lit gallery wall drawn with CSS
   3D. Every story's cover hangs on it as a polaroid in an arched alcove, the
   topic of each run of stories is written on the floor, and scrolling (or
   dragging) walks the camera along the curve. Clicking a photo walks up to
   it, the room fades, and the photo becomes the story's cover.

   Geometry: the wall is an arc of a big circle seen from above. The camera
   walks a smaller circle inside it, looking ahead and to the right, so the
   wall curves away in front of you and the frames shrink into the distance.
   Positions along the wall are arc lengths (s) in px. */

// CSS perspective, i.e. the camera's focal length: a wider lens on narrow phone screens
const focal = () => Math.round(Math.min(760, Math.max(430, window.innerWidth * 1.1)))
const RW = 2600 // radius of the wall
const RC = 1800 // radius the camera walks along
const LOOK = 860 // arc length between the camera and the frame it looks at
const YAW = (38 * Math.PI) / 180 // how far right of "straight ahead" the camera looks
const SPACING = 600 // between two frames
const GROUP_GAP = 900 // extra space before the next room, for its title wall
const SEG = 260 // width of one wall panel
const FLOOR_Y = 520 // floor, measured down from eye level
const WALL_TOP = -760 // ceiling
const FOG_START = 2200
const FOG_END = 4800
const FLOOR_IN = RC + 160 // floor and ceiling are drawn from the wall to just past the camera
const SCROLL_PER_PX = 0.75 // page scroll per px walked
const ENTRY_PX = 1400 // page scroll spent walking up to the house and through the door
const ENTRY_BACK = 460 // how far back the camera starts, so the corridor comes toward you

const FRAME_W = 520
const FRAME_H = 860
const FRAME_Y = 15 // the alcove runs from high on the wall down to the skirting
const PHOTO_H = 372 // the framed print's height, used to frame it for the fly-in
const LAMP_Y = WALL_TOP + 70

// AIESEC brand colours
const BLUE = '#037ef3'

const OTHER = 'More stories'
const TOPICS = STORY_CHAPTERS.filter((c) => c !== 'All') as readonly string[]

interface Cam {
  s: number
  yaw: number
  r: number
  fade: number
}

/* Everything in the room is a flat piece placed on a circle around the
   room's centre. Pieces marked `mirror` are upside-down copies under the
   floor: the floor is slightly see-through, so they show as reflections in
   the polished surface. */
type Piece =
  | { kind: 'wall'; key: string; s: number; mirror?: boolean }
  | { kind: 'planks'; key: string; s: number }
  | { kind: 'ceiling'; key: string; s: number }
  | { kind: 'intro'; key: string; s: number }
  | { kind: 'floor'; key: string; s: number; text: string; color: string }
  | { kind: 'lamp'; key: string; s: number; mirror?: boolean }
  | { kind: 'beam'; key: string; s: number }
  | { kind: 'pool'; key: string; s: number; color: string }
  | { kind: 'frame'; key: string; s: number; post: BlogPost; number: number; mirror?: boolean }
  | { kind: 'empty'; key: string; s: number; mirror?: boolean }
  | {
      kind: 'title'
      key: string
      s: number
      text: string
      color: string
      index: number
      count: number
    }

type FramePieceData = Extract<Piece, { kind: 'frame' }>

interface Stop {
  name: string
  s: number
  color: string
}

/** A spotlit place on the wall: the lamp above it, its beam, the light it throws on the floor. */
const lit = (key: string, s: number, color: string, lite: boolean): Piece[] =>
  lite
    ? [
        { kind: 'lamp', key: `lamp-${key}`, s },
        { kind: 'pool', key: `pool-${key}`, s, color },
      ]
    : [
        { kind: 'lamp', key: `lamp-${key}`, s },
        { kind: 'lamp', key: `mlamp-${key}`, s, mirror: true },
        { kind: 'beam', key: `beam-${key}`, s },
        { kind: 'pool', key: `pool-${key}`, s, color },
      ]

function layoutHall(posts: BlogPost[], numbers: Map<string, number>, lite = false) {
  const known = new Set(TOPICS)
  const groups = [...TOPICS, OTHER]
    .map((name) => ({
      name,
      posts: posts.filter((p) => (name === OTHER ? !known.has(p.category) : p.category === name)),
    }))
    .filter((g) => g.posts.length > 0)

  const pieces: Piece[] = [
    { kind: 'intro', key: 'intro', s: LOOK },
    ...lit('intro', LOOK, BLUE, lite),
  ]
  const stops: Stop[] = []
  let s = LOOK + 1500
  for (const g of groups) {
    const color = g.name === OTHER ? BLUE : categoryColor(g.name)
    pieces.push(
      { kind: 'floor', key: `floor-${g.name}`, s: s - 600, text: g.name, color },
      {
        kind: 'title',
        key: `title-${g.name}`,
        s: s - 600,
        text: g.name,
        color,
        index: stops.length + 1,
        count: g.posts.length,
      },
      ...lit(`title-${g.name}`, s - 600, color, lite),
    )
    stops.push({ name: g.name, s, color })
    for (const post of g.posts) {
      const number = numbers.get(post.id) ?? 0
      pieces.push(
        { kind: 'frame', key: post.id, s, post, number },
        ...(lite
          ? []
          : [{ kind: 'frame', key: `m-${post.id}`, s, post, number, mirror: true } as Piece]),
        ...lit(post.id, s, color, lite),
      )
      s += SPACING
    }
    s += GROUP_GAP
  }
  const end = s - GROUP_GAP + SPACING
  pieces.push(
    { kind: 'empty', key: 'empty', s: end },
    ...(lite ? [] : [{ kind: 'empty', key: 'm-empty', s: end, mirror: true } as Piece]),
    ...lit('empty', end, '#ffc845', lite),
  )
  for (let w = -1400; w < end + 3200; w += SEG) {
    pieces.unshift(
      { kind: 'wall', key: `w${w}`, s: w },
      ...(lite ? [] : [{ kind: 'wall', key: `mw${w}`, s: w, mirror: true } as Piece]),
      { kind: 'planks', key: `f${w}`, s: w },
      { kind: 'ceiling', key: `c${w}`, s: w },
    )
  }
  return { pieces, stops, groups, sMax: end - LOOK }
}

// flat pieces stand off the curved wall by the curve's bulge over their width,
// so the wall never cuts through their edges
const bulge = (w: number) => (w * w) / (8 * RW) + 4
const radiusOf = (p: Piece) => {
  switch (p.kind) {
    case 'wall':
      return RW
    case 'planks':
    case 'ceiling':
      return (RW + FLOOR_IN) / 2
    case 'floor':
      return RW - 330
    case 'pool':
      return RW - 210
    case 'intro':
      return RW - bulge(1200)
    case 'title':
      return RW - bulge(600)
    case 'lamp':
      return RW - 70
    case 'beam':
      return RW - 45
    default:
      return RW - bulge(FRAME_W)
  }
}

/** [width, height, centre height] */
const sizeOf = (p: Piece): [number, number, number] => {
  switch (p.kind) {
    case 'wall':
      return [SEG + 6, FLOOR_Y - WALL_TOP, (FLOOR_Y + WALL_TOP) / 2]
    case 'planks':
      return [SEG + 1, RW - FLOOR_IN, FLOOR_Y]
    case 'ceiling':
      return [SEG + 6, RW - FLOOR_IN, WALL_TOP]
    case 'floor':
      return [1000, 150, FLOOR_Y - 4]
    case 'pool':
      return [620, 420, FLOOR_Y - 2]
    case 'intro':
      return [1200, 380, -120]
    case 'title':
      return [600, 560, -40]
    case 'lamp':
      return [72, 96, LAMP_Y]
    case 'beam':
      return [560, 900, LAMP_Y + 30 + 450]
    default:
      return [FRAME_W, FRAME_H, FRAME_Y]
  }
}

// floor panels taper toward the centre so neighbours meet without overlapping
const PLANK_CLIP = `polygon(0 0, 100% 0, ${50 + (50 * FLOOR_IN) / RW}% 100%, ${50 - (50 * FLOOR_IN) / RW}% 100%)`

const isMirror = (p: Piece) => 'mirror' in p && !!p.mirror

/** Static placement, relative to the room's centre. */
function placement(p: Piece) {
  const phi = p.s / RW
  const r = radiusOf(p)
  const [, , y0] = sizeOf(p)
  const mirror = isMirror(p)
  const y = mirror ? 2 * FLOOR_Y - y0 : y0
  const turn =
    p.kind === 'floor' || p.kind === 'planks' || p.kind === 'pool'
      ? ' rotateX(90deg)'
      : p.kind === 'ceiling'
        ? ' rotateX(-90deg)'
        : mirror
          ? ' scaleY(-1)'
          : ''
  return `translate3d(${(r * Math.cos(phi)).toFixed(1)}px, ${y}px, ${(-r * Math.sin(phi)).toFixed(1)}px) rotateY(${(phi - Math.PI / 2).toFixed(5)}rad)${turn}`
}

function peekReturn(): HallReturn | null {
  try {
    return JSON.parse(sessionStorage.getItem('cs-hall-return') ?? 'null') as HallReturn | null
  } catch {
    return null
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: Cam, b: Cam, t: number): Cam => ({
  s: lerp(a.s, b.s, t),
  yaw: lerp(a.yaw, b.yaw, t),
  r: lerp(a.r, b.r, t),
  fade: lerp(a.fade, b.fade, t),
})
/** Standing right in front of a frame, facing it, close enough to fill the view. */
const facing = (s: number): Cam => ({
  s,
  yaw: Math.PI / 2,
  r: RW - Math.max(380, (focal() * PHOTO_H) / (window.innerHeight * 0.68)),
  fade: 1,
})

/* ─── Pieces ─── */

/** A framed print: slim black frame, deep white mat, the writer's signature on the mat. */
function Polaroid({ post, number }: { post: BlogPost; number: number }) {
  return (
    <span className="relative block w-[300px] bg-[linear-gradient(135deg,#2b2b2b,#0c0c0c_40%,#1c1c1c)] p-[7px] shadow-[0_0_0_1px_rgba(255,255,255,.06),0_50px_60px_-30px_rgba(0,0,0,.9),0_0_80px_-20px_rgba(255,214,150,.35)] transition-[filter,transform,box-shadow] duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_0_0_1px_rgba(255,255,255,.1),0_60px_70px_-30px_rgba(0,0,0,.95),0_0_110px_-16px_rgba(255,214,150,.55)]">
      <span className="block bg-[#fbfaf7] px-[10px] pt-[10px] shadow-[inset_0_2px_8px_rgba(0,0,0,.18)]">
        <span
          data-photo
          className="relative block h-[276px] w-[266px] overflow-hidden bg-[#10213f] shadow-[0_0_0_1px_rgba(0,0,0,.12)]"
        >
          {post.cover_image_url ? (
            <img
              src={post.cover_image_url}
              alt=""
              draggable={false}
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <span className="block size-full bg-[linear-gradient(140deg,#037ef3,#10213f)]" />
          )}
          {/* the glass: a soft sheen from the spotlight above */}
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,.28)_0%,rgba(255,255,255,.06)_30%,transparent_45%)]" />
        </span>
        <span className="flex h-[52px] items-center justify-between gap-2 px-0.5">
          <span className="font-hand truncate text-[25px] leading-none text-[#0b1a33]">
            {post.author_name}
          </span>
          <span className="shrink-0 text-[9px] font-semibold tracking-[0.14em] text-[#0b1a33]/40">
            No.{String(number).padStart(3, '0')}
          </span>
        </span>
      </span>
    </span>
  )
}

/** The wash of light the spotlight throws on the wall. */
function Alcove({ color }: { color?: string }) {
  return (
    <span
      data-fade
      className="absolute inset-0 transition-opacity duration-500"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 52% 44% at 50% 31%, rgba(255,226,176,.5), rgba(255,206,140,.16) 48%, transparent 72%)',
      }}
    >
      {color && (
        <span
          className="absolute inset-x-[38%] bottom-[60px] h-[3px] rounded-full"
          style={{ background: color, boxShadow: `0 0 16px ${color}` }}
        />
      )}
    </span>
  )
}

function FramePiece({
  post,
  number,
  focused,
  onOpen,
}: {
  post: BlogPost
  number: number
  focused: boolean
  onOpen: (e: React.MouseEvent) => void
}) {
  const color = categoryColor(post.category)
  return (
    <>
      <Alcove color={color} />
      <Link
        to={`/blog/${post.id}`}
        onClick={onOpen}
        tabIndex={-1}
        aria-hidden="true"
        draggable={false}
        className="group absolute top-[150px] left-1/2 flex -translate-x-1/2 flex-col items-center"
      >
        <span
          className={`block transition-[outline-color] ${focused ? 'outline-4 outline-offset-8 outline-[#037ef3]' : 'outline-0'}`}
        >
          <Polaroid post={post} number={number} />
        </span>
        {/* the wall label: lifts when you point at the photo */}
        <span
          data-fade
          className="mt-10 block w-[300px] border-l-2 py-1 pl-4 text-left transition-[transform,opacity] duration-300 group-hover:-translate-y-2"
          style={{ borderColor: color }}
        >
          <span
            className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.16em] uppercase"
            style={{ color }}
          >
            <span className="size-1.5 rounded-full" style={{ background: color }} />
            {post.category}
          </span>
          <span className="font-museum mt-1.5 line-clamp-2 block text-[19px] leading-[1.2] font-medium text-[#f4efe6]">
            {post.title}
          </span>
          <span className="mt-1.5 block text-[12px] tracking-[0.04em] text-white/45">
            {formatStoryDate(post, 'long')}, {post.read_time} min read
          </span>
        </span>
      </Link>
    </>
  )
}

/** The same frame, upside down under the floor, as its reflection. */
function FrameReflection({ post, number }: { post: BlogPost; number: number }) {
  return (
    <>
      <Alcove color={categoryColor(post.category)} />
      <span className="absolute top-[150px] left-1/2 -translate-x-1/2">
        <Polaroid post={post} number={number} />
      </span>
    </>
  )
}

function EmptyPiece({ onWrite }: { onWrite?: () => void }) {
  const inner = (
    <>
      <span className="flex size-16 items-center justify-center rounded-full bg-[#037ef3] text-white shadow-[0_0_30px_rgba(3,126,243,.6)] transition-transform group-hover:scale-110">
        <Plus size={28} />
      </span>
      <span className="font-hand text-[34px] leading-[1.05] text-[#f4efe6]">
        This frame is saved for your story.
      </span>
    </>
  )
  const cls =
    'group absolute top-[150px] left-1/2 flex h-[372px] w-[300px] -translate-x-1/2 flex-col items-center justify-center gap-4 border-2 border-dashed border-[#e6c98f]/60 bg-white/[.04] p-6 text-center transition-colors hover:border-[#e6c98f]'
  return (
    <>
      <Alcove color="#ffc845" />
      {onWrite ? (
        <button type="button" onClick={onWrite} tabIndex={-1} aria-hidden="true" className={cls}>
          {inner}
        </button>
      ) : (
        <span className={cls}>{inner}</span>
      )}
    </>
  )
}

/** A track spotlight hanging from the ceiling. */
function Lamp() {
  return (
    <span className="relative block size-full">
      <span className="absolute top-0 left-1/2 h-[26px] w-[6px] -translate-x-1/2 bg-[#06101f]" />
      <span className="absolute top-[22px] left-1/2 h-[58px] w-[44px] -translate-x-1/2 rounded-[10px_10px_16px_16px] bg-[linear-gradient(90deg,#06101f,#22365a_45%,#0b1a33)] shadow-[0_6px_10px_rgba(0,0,0,.4)]" />
      <span className="absolute top-[74px] left-1/2 h-[14px] w-[38px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,#ffffff,#ffe6bd_45%,rgba(255,200,120,0)_75%)] shadow-[0_0_26px_12px_rgba(255,214,150,.55)]" />
    </span>
  )
}

/** The cone of light from a lamp down onto the frame. */
function Beam() {
  return (
    <span className="block size-full blur-[8px]">
      <span
        className="block size-full bg-[linear-gradient(rgba(255,226,176,.26),rgba(255,214,150,.08)_60%,transparent)]"
        style={{ clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)' }}
      />
    </span>
  )
}

/* ─── The 3D hall (phones get a lighter version of the same room) ─── */

function Hall({
  posts,
  numbers,
  onList,
  onWrite,
  lite,
}: {
  posts: BlogPost[]
  numbers: Map<string, number>
  onList: () => void
  onWrite: () => void
  lite: boolean
}) {
  const navigate = useNavigate()
  const navType = useNavigationType()
  const location = useLocation()
  const { pieces, stops, sMax } = useMemo(
    () => layoutHall(posts, numbers, lite),
    [posts, numbers, lite],
  )
  const frames = useMemo(
    () => pieces.filter((p): p is FramePieceData => p.kind === 'frame' && !p.mirror),
    [pieces],
  )

  const sectionRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const whiteRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const uiRef = useRef<HTMLDivElement>(null)
  const nodes = useRef<(HTMLDivElement | null)[]>([])
  const shown = useRef<(boolean | undefined)[]>([])
  const cam = useRef<Cam>({ s: 0, yaw: YAW, r: RC, fade: 0 })
  const mode = useRef<'walk' | 'fly' | 'return'>('walk')
  const target = useRef<string | null>(null)
  const activeRef = useRef(-1)
  const parked = useRef(false)
  const [active, setActive] = useState(0)
  const [started, setStarted] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)

  const render = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    const { s, yaw, r: R, fade } = cam.current
    const P = focal()
    if (stageRef.current) stageRef.current.style.perspective = `${P}px`
    const phc = s / RW
    world.style.transform = `translateZ(${P}px) rotateY(${yaw}rad) translateX(${-R}px) rotateY(${-phc}rad)`
    if (whiteRef.current) whiteRef.current.style.opacity = String(fade)
    if (barRef.current)
      barRef.current.style.transform = `scaleX(${sMax > 0 ? Math.min(1, Math.max(0, s / sMax)) : 0})`

    const sinY = Math.sin(yaw)
    const cosY = Math.cos(yaw)
    const tanH = window.innerWidth / 2 / P
    pieces.forEach((p, i) => {
      const el = nodes.current[i]
      if (!el) return
      // where this piece is, seen from the camera
      const d = p.s / RW - phc
      const r = radiusOf(p)
      const x = -R + r * Math.cos(d)
      const z = -r * Math.sin(d)
      const xe = x * cosY + z * sinY
      const depth = x * sinY - z * cosY
      const near = p.kind === 'wall' || p.kind === 'planks' || p.kind === 'ceiling' ? 300 : 160
      const visible =
        d > -0.7 && d < 2.3 && depth > near && Math.abs(xe) < depth * tanH + FRAME_W + SEG
      if (shown.current[i] !== visible) {
        shown.current[i] = visible
        el.style.visibility = visible ? 'visible' : 'hidden'
      }
      if (!visible) return
      const fog = Math.min(1, Math.max(0, (FOG_END - depth) / (FOG_END - FOG_START)))
      const keep = p.kind === 'frame' && !p.mirror && p.key === target.current
      // parked behind the house: built and ready, but not drawn
      el.style.opacity = parked.current ? '0' : (keep ? fog : fog * (1 - fade)).toFixed(3)
    })

    let a = 0
    stops.forEach((st, i) => {
      if (s >= st.s - LOOK - 320) a = i
    })
    if (a !== activeRef.current) {
      activeRef.current = a
      setActive(a)
    }
  }, [pieces, stops, sMax])

  // walking: page scroll, smoothed, moves the camera
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 110, damping: 26, restDelta: 0.0002 })
  // the first part of the scroll is the walk up to the house and in through the door
  const walkPx = sMax * SCROLL_PER_PX
  const entryShare = ENTRY_PX / (ENTRY_PX + walkPx)
  const entry = useMotionValue(0)
  useEffect(() => {
    for (const p of posts) {
      if (!p.cover_image_url) continue
      const img = new Image()
      img.src = p.cover_image_url
      img.decode().catch(() => {})
    }
  }, [posts])
  const covers = useMemo(
    () =>
      posts
        .map((p) => p.cover_image_url)
        .filter((u): u is string => !!u)
        .slice(0, 6),
    [posts],
  )
  const camAt = useCallback(
    (v: number): Cam => {
      const e = Math.min(1, v / entryShare)
      const s = v <= entryShare ? 0 : ((v - entryShare) / (1 - entryShare)) * sMax
      return { s, yaw: YAW, r: RC - ENTRY_BACK * (1 - e) ** 2, fade: 0 }
    },
    [entryShare, sMax],
  )
  const showUi = useCallback(
    (v: number) => {
      const ui = uiRef.current
      if (!ui) return
      const k = Math.min(1, Math.max(0, (v / entryShare - 0.9) / 0.1))
      ui.style.opacity = String(k)
      ui.style.visibility = k > 0 ? 'visible' : 'hidden'
    },
    [entryShare],
  )
  const hideWorld = useCallback((v: number) => v / entryShare < 0.62, [entryShare])
  useMotionValueEvent(smooth, 'change', (v) => {
    entry.set(Math.min(1, v / entryShare))
    showUi(v)
    if (v > entryShare + 0.01) setStarted(true)
    if (mode.current !== 'walk') return
    cam.current = camAt(v)
    // while the house covers the screen the corridor is parked: built once, not redrawn
    if (hideWorld(v)) {
      if (!parked.current) {
        parked.current = true
        render()
      }
      return
    }
    parked.current = false
    render()
  })

  useLayoutEffect(() => {
    cam.current = camAt(smooth.get())
    entry.set(Math.min(1, smooth.get() / entryShare))
    showUi(smooth.get())
    // build the corridor right away (behind the house), then park it a moment later
    parked.current = false
    render()
    const park = window.setTimeout(() => {
      if (mode.current === 'walk' && hideWorld(smooth.get())) {
        parked.current = true
        render()
      }
    }, 900)
    const onResize = () => render()
    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(park)
      window.removeEventListener('resize', onResize)
    }
  }, [render, smooth, camAt, entry, entryShare, showUi, hideWorld])

  const scrollRange = () => {
    const el = sectionRef.current
    if (!el) return { top: 0, span: 1 }
    const top = el.getBoundingClientRect().top + window.scrollY
    return { top, span: Math.max(1, el.offsetHeight - window.innerHeight) }
  }
  /** Page scroll position that puts the camera at walk position s. */
  const scrollFor = (s: number) => {
    const { top, span } = scrollRange()
    return top + (entryShare + (Math.min(Math.max(s, 0), sMax) / sMax) * (1 - entryShare)) * span
  }

  // coming back from a story: pull the camera back out of the photo it entered
  useEffect(() => {
    const fromStory = navType === 'POP' || (location.state as { hall?: boolean } | null)?.hall
    const back = peekReturn()
    const frame = back ? frames.find((f) => f.post.id === back.id) : undefined
    if (!fromStory || !back || !frame) return
    const y = back.y
    let stop: { stop: () => void } | undefined
    const raf = requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: 'instant' })
      const { top, span } = scrollRange()
      const v = Math.min(Math.max((y - top) / span, 0), 1)
      const walkTo = camAt(v)
      smooth.jump(v)
      entry.set(Math.min(1, v / entryShare))
      showUi(v)
      mode.current = 'return'
      setStarted(true)
      target.current = frame.key
      const from = facing(frame.s)
      stop = animate(0, 1, {
        duration: 1.3,
        ease: [0.33, 0, 0.2, 1],
        onUpdate: (t) => {
          cam.current = mix(from, walkTo, t)
          render()
        },
        onComplete: () => {
          takeHallReturn()
          mode.current = 'walk'
          target.current = null
        },
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      stop?.stop()
      mode.current = 'walk'
    }
    // only on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // dragging sideways walks too
  const drag = useRef({ x: 0, moved: 0, down: false })
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d.down) return
      const dx = e.clientX - d.x
      d.x = e.clientX
      d.moved += Math.abs(dx)
      if (d.moved > 6) window.scrollBy({ top: -dx * 2.4, behavior: 'instant' })
    }
    const up = () => {
      drag.current.down = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  const open = (frame: FramePieceData, el: HTMLElement | null) => {
    if (mode.current !== 'walk') return
    mode.current = 'fly'
    target.current = frame.key
    el?.querySelectorAll<HTMLElement>('[data-fade]').forEach((n) => (n.style.opacity = '0'))
    saveHallReturn({ y: window.scrollY, id: frame.post.id })
    const from = { ...cam.current }
    const to = facing(frame.s)
    animate(0, 1, {
      duration: 1.15,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: (t) => {
        cam.current = mix(from, to, t)
        render()
      },
      onComplete: () => {
        const photo = el?.querySelector('[data-photo]')
        flyIntoStory({
          from: photo ? photo.getBoundingClientRect() : new DOMRect(0, 0, 0, 0),
          src: frame.post.cover_image_url,
          background: '#060d1b',
          go: () => navigate(`/blog/${frame.post.id}`),
        })
      },
    })
  }

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: `calc(100svh + ${Math.round(ENTRY_PX + sMax * SCROLL_PER_PX)}px)` }}
      aria-labelledby="hall-title"
    >
      <div
        className="sticky top-0 h-svh min-h-[620px] cursor-grab touch-pan-y overflow-hidden select-none active:cursor-grabbing"
        style={{ perspective: `${focal()}px` }}
        ref={stageRef}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          drag.current = { x: e.clientX, moved: 0, down: true }
        }}
        onClickCapture={(e) => {
          // a drag that ends on a photo is not a click
          if (drag.current.moved > 6) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        {/* the far end of the corridor, lost in darkness */}
        <div className="absolute inset-0 bg-[linear-gradient(#03070f_0%,#081226_42%,#122442_49.6%,#0c1424_50.4%,#05090f_100%)]" />
        <div ref={whiteRef} className="absolute inset-0 bg-[#060d1b] opacity-0" />

        <div ref={worldRef} className="absolute top-1/2 left-1/2 size-0 transform-3d">
          {pieces.map((p, i) => {
            const [w, h] = sizeOf(p)
            const mirror = isMirror(p)
            return (
              <div
                key={p.key}
                ref={(el) => {
                  nodes.current[i] = el
                }}
                className={`absolute top-0 left-0 ${mirror || p.kind === 'beam' ? 'pointer-events-none' : ''}`}
                aria-hidden={mirror || undefined}
                style={{
                  width: w,
                  height: h,
                  marginLeft: -w / 2,
                  marginTop: -h / 2,
                  transform: placement(p),
                  visibility: 'hidden',
                }}
              >
                {p.kind === 'wall' && (
                  // deep navy fluted panels, a brass rail above the skirting, blue light lines top and bottom
                  <div className="size-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.045)_0_1px,rgba(0,0,0,.16)_1px_3px,transparent_3px_22px),linear-gradient(#037ef3_0%,#5fb0ff_0.35%,#060c18_0.9%,#0c1830_9%,#11203b_50%,#0d1a31_92%,#0a1428_95%,#b8955a_95.15%,#f0d9a6_95.4%,#8f6f3d_95.65%,#080f1d_95.9%,#050a14_99.1%,#037ef3_100%)]" />
                )}
                {p.kind === 'planks' && (
                  // polished dark walnut: slightly see-through so the reflections below show
                  <div
                    className="size-full bg-[repeating-linear-gradient(rgba(255,235,210,.035)_0_1px,transparent_1px_64px),linear-gradient(rgba(3,126,243,.5)_0%,rgba(42,30,22,.8)_1.4%,rgba(36,26,19,.78)_40%,rgba(18,13,10,.94)_100%)]"
                    style={{ clipPath: PLANK_CLIP }}
                  />
                )}
                {p.kind === 'ceiling' && (
                  <div className="size-full bg-[linear-gradient(#03070e_0%,#070e1b_42%,#2a4a7a_46.5%,#e9f4ff_48.6%,#ffffff_49.4%,#e9f4ff_50.2%,#2a4a7a_52.3%,#070e1b_57%,#09121f_96.5%,#5fb0ff_99%,#037ef3_100%)]" />
                )}
                {p.kind === 'lamp' && <Lamp />}
                {p.kind === 'beam' && <Beam />}
                {p.kind === 'pool' && (
                  <div
                    className="size-full"
                    style={{
                      background: `radial-gradient(ellipse 50% 60% at 50% 0%, rgba(255,222,170,.22), ${p.color}26 45%, transparent 72%)`,
                    }}
                  />
                )}
                {p.kind === 'intro' && (
                  <div className="flex size-full flex-col items-center justify-center text-center text-[#f4efe6]">
                    <span className="text-[15px] font-bold tracking-[0.34em] text-[#e6c98f] uppercase">
                      The Story House · AIESEC in Colombo South
                    </span>
                    <span className="font-hand mt-4 text-[96px] leading-[0.95]">
                      Pages written by the people who went.
                    </span>
                  </div>
                )}
                {p.kind === 'floor' && (
                  // the wing's name, projected on the floor in its colour
                  <div className="flex size-full flex-col items-center justify-center text-center">
                    <span className="text-[16px] font-semibold tracking-[0.4em] text-white/35 uppercase">
                      Room
                    </span>
                    <span
                      className="font-museum text-[64px] leading-none font-semibold tracking-[0.04em] uppercase"
                      style={{
                        color: p.color,
                        textShadow: `0 0 18px ${p.color}, 0 0 44px ${p.color}88`,
                        opacity: 0.85,
                      }}
                    >
                      {p.text}
                    </span>
                  </div>
                )}
                {p.kind === 'title' && (
                  <div className="flex size-full flex-col items-start justify-center px-10 text-left text-[#f4efe6]">
                    <span className="text-[15px] font-semibold tracking-[0.42em] text-[#e6c98f] uppercase">
                      Room {String(p.index).padStart(2, '0')}
                    </span>
                    <span
                      className="mt-6 block h-[2px] w-16"
                      style={{ background: p.color, boxShadow: `0 0 18px ${p.color}` }}
                    />
                    <span className="font-museum mt-6 text-[66px] leading-[1.02] font-medium text-balance">
                      {p.text}
                    </span>
                    <span className="mt-6 text-[17px] tracking-[0.08em] text-white/50">
                      {p.count} {p.count === 1 ? 'story' : 'stories'} in this room
                    </span>
                  </div>
                )}
                {p.kind === 'frame' &&
                  (mirror ? (
                    <FrameReflection post={p.post} number={p.number} />
                  ) : (
                    <FramePiece
                      post={p.post}
                      number={p.number}
                      focused={focusId === p.post.id}
                      onOpen={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                        e.preventDefault()
                        open(p, nodes.current[i])
                      }}
                    />
                  ))}
                {p.kind === 'empty' && <EmptyPiece onWrite={mirror ? undefined : onWrite} />}
              </div>
            )
          })}
        </div>

        <HouseFacade
          progress={entry}
          covers={covers}
          onEnter={() => window.scrollTo({ top: scrollFor(0), behavior: 'smooth' })}
        />

        {/* lens: darker corners and a little film grain */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_75%_at_50%_48%,transparent_55%,rgba(0,0,0,.5)_100%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* what is on screen, around the room */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-24 md:gap-6 md:px-10 md:pt-28">
          <div className="rounded-[14px] bg-[#0b1a33]/80 px-4 py-2.5 shadow-[0_14px_30px_-16px_rgba(0,0,0,.8)] ring-1 ring-white/10 backdrop-blur-md">
            <p className="text-[10px] font-bold tracking-[0.24em] text-[#7cc0ff] uppercase md:text-[11px] md:tracking-[0.28em]">
              AIESEC in Colombo South
            </p>
            <h1
              id="hall-title"
              className="font-display mt-0.5 text-[20px] leading-[1.05] font-bold tracking-[-0.01em] text-white md:text-[26px] lg:text-[30px]"
            >
              The Story House
            </h1>
          </div>
          <button
            type="button"
            onClick={onList}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#0b1a33]/80 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-12px_rgba(0,0,0,.8)] backdrop-blur transition-colors hover:bg-[#0b1a33] focus-visible:outline-2 focus-visible:outline-[#037ef3]"
          >
            <List size={15} /> <span className="max-md:hidden">Show as list</span>
            <span className="md:hidden">List</span>
          </button>
        </div>

        {/* only once you are inside: how to walk, and the rooms */}
        <div ref={uiRef} className="invisible opacity-0 transition-opacity duration-300">
          <p
            className={`pointer-events-none absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#037ef3] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_0_24px_rgba(3,126,243,.55)] transition-opacity duration-500 ${started ? 'opacity-0' : 'opacity-100'}`}
          >
            <MoveHorizontal size={15} /> Scroll or swipe to walk through
          </p>

          {/* the same hall as plain links, for keyboards and screen readers;
            focusing one walks the camera to it */}
          <ul className="sr-only">
            {frames.map((f) => (
              <li key={f.key}>
                <Link
                  to={`/blog/${f.post.id}`}
                  onFocus={() => {
                    setFocusId(f.post.id)
                    window.scrollTo({ top: scrollFor(f.s - LOOK), behavior: 'smooth' })
                  }}
                  onBlur={() => setFocusId(null)}
                >
                  {f.post.title}, by {f.post.author_name}
                </Link>
              </li>
            ))}
            <li>
              <button type="button" onClick={onWrite}>
                Write your page
              </button>
            </li>
          </ul>

          <nav
            className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-4 md:px-10 md:pb-6"
            aria-label="Rooms of the house"
          >
            <div className="max-w-full rounded-[22px] bg-[#0b1a33]/85 p-2 shadow-[0_18px_40px_-18px_rgba(11,26,51,.8)] ring-1 ring-white/10 backdrop-blur-md">
              <div className="flex [scrollbar-width:none] items-center gap-1 overflow-x-auto whitespace-nowrap">
                {stops.map((st, i) => (
                  <button
                    key={st.name}
                    type="button"
                    onClick={() =>
                      window.scrollTo({ top: scrollFor(st.s - LOOK), behavior: 'smooth' })
                    }
                    className="flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ffc845]"
                    style={
                      i === active
                        ? {
                            background: '#037ef3',
                            color: '#ffffff',
                            boxShadow: '0 0 20px rgba(3,126,243,.55)',
                          }
                        : { background: 'transparent', color: 'rgba(255,255,255,.85)' }
                    }
                    aria-current={i === active ? 'true' : undefined}
                  >
                    <span className="size-2 rounded-full" style={{ background: st.color }} />
                    {st.name}
                  </button>
                ))}
              </div>
              <div className="mx-3 mt-2 mb-1 h-[3px] overflow-hidden rounded-full bg-white/15">
                <div
                  ref={barRef}
                  className="h-full origin-left scale-x-0 rounded-full bg-[#ffc845]"
                />
              </div>
            </div>
          </nav>
        </div>
      </div>
    </section>
  )
}

function useWide() {
  const query = '(min-width: 768px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = (e: MediaQueryListEvent) => setWide(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

export function ExhibitionHall(props: {
  posts: BlogPost[]
  numbers: Map<string, number>
  onList: () => void
  onWrite: () => void
}) {
  const wide = useWide()
  return <Hall key={wide ? 'wide' : 'lite'} {...props} lite={!wide} />
}

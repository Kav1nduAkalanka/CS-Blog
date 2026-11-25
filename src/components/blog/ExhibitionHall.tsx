import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { animate, useMotionValue, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { ChevronLeft, ChevronRight, List, MoveHorizontal, Plus } from 'lucide-react'
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

// CSS perspective, i.e. the camera's focal length: a wider lens on narrow phone screens,
// and wider still on short ones, so the print fits between the menu and the card
const focal = (lite = false) => {
  const p = Math.min(760, Math.max(430, window.innerWidth * 1.1))
  return Math.round(lite ? Math.max(260, Math.min(p, (window.innerHeight - 290) * 1.2)) : p)
}
/** Phones: eye level that centres the print between the menu (top) and the card (bottom). */
const eyeShift = (lite: boolean) => (lite ? Math.round(0.18 * focal(true) - 60) : 0)
const RW = 2600 // radius of the wall

/** Where the camera walks and where it looks. */
interface Geo {
  rc: number // radius the camera walks along
  yaw: number // how far right of "straight ahead" the camera looks
  look: number // arc length between the camera and the frame it looks at
  back: number // how far back the camera starts, so the corridor comes toward you
}
// wide screens: down the middle of the corridor, looking well ahead along the curve
const WIDE: Geo = { rc: 1800, yaw: (38 * Math.PI) / 180, look: 860, back: 460 }
// phones: close to the wall and turned toward it, so one framed print fills the screen
const NARROW: Geo = { rc: 2150, yaw: (58 * Math.PI) / 180, look: 264, back: 700 }

const SPACING = 600 // between two frames
const GROUP_GAP = 900 // extra space before the next room, for its title wall
const SEG = 260 // width of one wall panel
const FLOOR_Y = 520 // floor, measured down from eye level
const WALL_TOP = -760 // ceiling
const FOG_START = 2200
const FOG_END = 4800
const FLOOR_IN = WIDE.rc + 160 // floor and ceiling are drawn from the wall to past the camera
const SCROLL_PER_PX = 0.75 // page scroll per px walked
const ENTRY_PX = 1400 // page scroll spent walking up to the house and through the door

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
  | { kind: 'intro'; key: string; s: number; w: number; h: number }
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
      w: number
      text: string
      color: string
      index: number
      count: number
    }

type FramePieceData = Extract<Piece, { kind: 'frame' }>
type TitlePieceData = Extract<Piece, { kind: 'title' }>

/** A place the phone camera comes to rest: the welcome wall, a room's title, a story, the empty frame. */
type Point =
  | { kind: 'intro'; s: number }
  | { kind: 'title'; s: number; title: TitlePieceData }
  | { kind: 'frame'; s: number; frame: FramePieceData; index: number }
  | { kind: 'empty'; s: number }

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

function layoutHall(posts: BlogPost[], numbers: Map<string, number>, lite: boolean, LOOK: number) {
  const known = new Set(TOPICS)
  const groups = [...TOPICS, OTHER]
    .map((name) => ({
      name,
      posts: posts.filter((p) => (name === OTHER ? !known.has(p.category) : p.category === name)),
    }))
    .filter((g) => g.posts.length > 0)

  const pieces: Piece[] = [
    { kind: 'intro', key: 'intro', s: LOOK, w: lite ? 440 : 1200, h: lite ? 520 : 380 },
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
        w: lite ? 440 : 600,
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
    case 'title':
      return RW - bulge(p.w)
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
      return [p.w, p.h, -120]
    case 'title':
      return [p.w, 560, -40]
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

/** Index of the resting point closest to walk position s. */
function nearestPoint(points: Point[], s: number) {
  let best = 0
  points.forEach((p, i) => {
    if (Math.abs(p.s - s) < Math.abs(points[best].s - s)) best = i
  })
  return best
}

/** The page-scroll range the hall's walk spans. */
function scrollRange(el: HTMLElement | null) {
  if (!el) return { top: 0, span: 1 }
  const top = el.getBoundingClientRect().top + window.scrollY
  return { top, span: Math.max(1, el.offsetHeight - window.innerHeight) }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: Cam, b: Cam, t: number): Cam => ({
  s: lerp(a.s, b.s, t),
  yaw: lerp(a.yaw, b.yaw, t),
  r: lerp(a.r, b.r, t),
  fade: lerp(a.fade, b.fade, t),
})
/** Standing right in front of a frame, facing it, close enough to fill the view. */
const facing = (s: number, lite: boolean): Cam => ({
  s,
  yaw: Math.PI / 2,
  r: RW - Math.max(380, (focal(lite) * PHOTO_H) / (window.innerHeight * 0.68)),
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
  label,
  onOpen,
}: {
  post: BlogPost
  number: number
  focused: boolean
  label: boolean
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
        {/* the wall label: lifts when you point at the photo (phones read it in the card below) */}
        <span
          data-fade
          className={`mt-10 w-[300px] border-l-2 py-1 pl-4 text-left transition-[transform,opacity] duration-300 group-hover:-translate-y-2 ${label ? 'block' : 'hidden'}`}
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
  const G = lite ? NARROW : WIDE
  const LOOK = G.look
  const { pieces, stops, sMax } = useMemo(
    () => layoutHall(posts, numbers, lite, LOOK),
    [posts, numbers, lite, LOOK],
  )
  const frames = useMemo(
    () => pieces.filter((p): p is FramePieceData => p.kind === 'frame' && !p.mirror),
    [pieces],
  )
  // where the phone camera comes to rest, in walking order
  const points = useMemo(() => {
    const list: Point[] = [{ kind: 'intro', s: 0 }]
    for (const p of pieces) {
      if (p.kind === 'title') list.push({ kind: 'title', s: p.s - LOOK, title: p })
      if (p.kind === 'frame' && !p.mirror)
        list.push({ kind: 'frame', s: p.s - LOOK, frame: p, index: frames.indexOf(p) })
    }
    list.push({ kind: 'empty', s: sMax })
    return list.sort((a, b) => a.s - b.s)
  }, [pieces, frames, sMax, LOOK])

  const sectionRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const whiteRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const uiRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const nodes = useRef<(HTMLDivElement | null)[]>([])
  const shown = useRef<(boolean | undefined)[]>([])
  const cam = useRef<Cam>({ s: 0, yaw: G.yaw, r: G.rc, fade: 0 })
  const mode = useRef<'walk' | 'fly' | 'return'>('walk')
  const target = useRef<string | null>(null)
  const activeRef = useRef(-1)
  const atRef = useRef(0)
  const parked = useRef(false)
  const [active, setActive] = useState(0)
  const [at, setAt] = useState(0)
  const [started, setStarted] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)

  const render = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    const { s, yaw, r: R, fade } = cam.current
    const P = focal(lite)
    if (stageRef.current) stageRef.current.style.perspective = `${P}px`
    world.style.top = `calc(50% + ${eyeShift(lite)}px)`
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
    const n = nearestPoint(points, s)
    if (n !== atRef.current) {
      atRef.current = n
      setAt(n)
    }
  }, [pieces, stops, sMax, points, LOOK, lite])

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
      return { s, yaw: G.yaw, r: G.rc - G.back * (1 - e) ** 2, fade: 0 }
    },
    [entryShare, sMax, G],
  )
  const showUi = useCallback(
    (v: number) => {
      const ui = uiRef.current
      if (!ui) return
      const k = Math.min(1, Math.max(0, (v / entryShare - 0.9) / 0.1))
      ui.style.opacity = String(k)
      ui.style.visibility = k > 0 ? 'visible' : 'hidden'
      // on a phone the list button moves into the card once you are inside
      const top = topRef.current
      if (top && lite) {
        top.style.opacity = String(1 - k)
        top.style.visibility = k < 1 ? 'visible' : 'hidden'
      }
    },
    [entryShare, lite],
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

  /** Page scroll position that puts the camera at walk position s. */
  const scrollFor = useCallback(
    (s: number) => {
      const { top, span } = scrollRange(sectionRef.current)
      return top + (entryShare + (Math.min(Math.max(s, 0), sMax) / sMax) * (1 - entryShare)) * span
    },
    [entryShare, sMax],
  )
  /** Walk to resting point i (phones). */
  const goTo = useCallback(
    (i: number) => {
      const p = points[Math.min(points.length - 1, Math.max(0, i))]
      window.scrollTo({ top: scrollFor(p.s), behavior: 'smooth' })
    },
    [points, scrollFor],
  )

  // phones: when a swipe or scroll comes to rest, settle on the nearest story,
  // so there is always one print in front of you and never half of two
  useEffect(() => {
    if (!lite) return
    let timer = 0
    let touching = false
    const settle = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (touching || mode.current !== 'walk') return
        const { top, span } = scrollRange(sectionRef.current)
        const v = (window.scrollY - top) / span
        // halfway through the door finishes walking in; past the hall is left alone
        if (v < entryShare * 0.75 || v > 1) return
        const y = scrollFor(points[nearestPoint(points, camAt(v).s)].s)
        if (Math.abs(y - window.scrollY) > 3) window.scrollTo({ top: y, behavior: 'smooth' })
      }, 160)
    }
    const down = () => {
      touching = true
      window.clearTimeout(timer)
    }
    const up = () => {
      touching = false
      settle()
    }
    window.addEventListener('scroll', settle, { passive: true })
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchend', up)
    window.addEventListener('touchcancel', up)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', settle)
      window.removeEventListener('touchstart', down)
      window.removeEventListener('touchend', up)
      window.removeEventListener('touchcancel', up)
    }
  }, [lite, points, entryShare, camAt, scrollFor])

  // keep the current room's chip in view in the phone card
  useEffect(() => {
    const row = chipsRef.current
    const chip = row?.querySelector<HTMLElement>(`[data-room="${active}"]`)
    if (!row || !chip) return
    row.scrollTo({
      left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2,
      behavior: 'smooth',
    })
  }, [active])

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
      const { top, span } = scrollRange(sectionRef.current)
      const v = Math.min(Math.max((y - top) / span, 0), 1)
      const walkTo = camAt(v)
      smooth.jump(v)
      entry.set(Math.min(1, v / entryShare))
      showUi(v)
      mode.current = 'return'
      setStarted(true)
      target.current = frame.key
      const from = facing(frame.s, lite)
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

  // dragging sideways walks too; on a phone one swipe steps exactly one story
  const drag = useRef({ x: 0, x0: 0, from: 0, moved: 0, down: false })
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d.down) return
      const dx = e.clientX - d.x
      d.x = e.clientX
      d.moved += Math.abs(dx)
      if (d.moved > 6) window.scrollBy({ top: -dx * (lite ? 1.2 : 2.4), behavior: 'instant' })
    }
    const up = () => {
      const d = drag.current
      if (!d.down) return
      d.down = false
      const swipe = d.x - d.x0
      if (lite && mode.current === 'walk' && Math.abs(swipe) > 36)
        goTo(d.from + (swipe < 0 ? 1 : -1))
    }
    const cancel = () => {
      drag.current.down = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [lite, goTo])

  const open = (frame: FramePieceData, el: HTMLElement | null) => {
    if (mode.current !== 'walk') return
    mode.current = 'fly'
    target.current = frame.key
    el?.querySelectorAll<HTMLElement>('[data-fade]').forEach((n) => (n.style.opacity = '0'))
    saveHallReturn({ y: window.scrollY, id: frame.post.id })
    const from = { ...cam.current }
    const to = facing(frame.s, lite)
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

  const point = points[at] ?? points[0]
  const openFrame = (f: FramePieceData) => open(f, nodes.current[pieces.indexOf(f)])

  return (
    <section
      ref={sectionRef}
      // dark behind the stage, so a phone's browser bar sliding away never shows a blank strip
      className="relative bg-[#05090f]"
      style={{ height: `calc(100lvh + ${Math.round(ENTRY_PX + sMax * SCROLL_PER_PX)}px)` }}
      aria-labelledby="hall-title"
    >
      <div
        // dvh: the stage follows the visible screen as Safari's toolbar shows and hides
        className="sticky top-0 h-dvh cursor-grab touch-pan-y overflow-hidden select-none active:cursor-grabbing md:min-h-[620px]"
        style={{ perspective: `${focal(lite)}px` }}
        ref={stageRef}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          drag.current = { x: e.clientX, x0: e.clientX, from: atRef.current, moved: 0, down: true }
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

        <div
          ref={worldRef}
          className="absolute left-1/2 size-0 transform-3d"
          // phones: eye level shifted so the print sits between the menu and the card
          style={{ top: `calc(50% + ${eyeShift(lite)}px)` }}
        >
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
                  <div className="flex size-full flex-col items-center justify-center px-6 text-center text-[#f4efe6]">
                    <span
                      className="font-bold tracking-[0.34em] text-[#e6c98f] uppercase"
                      style={{ fontSize: lite ? 13 : 15 }}
                    >
                      The Story House · AIESEC in Colombo South
                    </span>
                    <span
                      className="font-hand mt-4 leading-[0.95]"
                      style={{ fontSize: lite ? 64 : 96 }}
                    >
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
                  <div
                    className="flex size-full flex-col items-start justify-center text-left text-[#f4efe6]"
                    style={{ paddingInline: lite ? 28 : 40 }}
                  >
                    <span className="text-[15px] font-semibold tracking-[0.42em] text-[#e6c98f] uppercase">
                      Room {String(p.index).padStart(2, '0')}
                    </span>
                    <span
                      className="mt-6 block h-[2px] w-16"
                      style={{ background: p.color, boxShadow: `0 0 18px ${p.color}` }}
                    />
                    <span
                      className="font-museum mt-6 leading-[1.02] font-medium text-balance"
                      style={{ fontSize: lite ? 54 : 66 }}
                    >
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
                      label={!lite}
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
        <div
          ref={topRef}
          className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-24 transition-opacity duration-300 md:gap-6 md:px-10 md:pt-28"
        >
          {/* phones: the house's own sign names it, so the card is for screen readers only */}
          <div className="rounded-[14px] bg-[#0b1a33]/80 px-4 py-2.5 shadow-[0_14px_30px_-16px_rgba(0,0,0,.8)] ring-1 ring-white/10 backdrop-blur-md max-md:sr-only">
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
            className="pointer-events-auto ml-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#0b1a33]/80 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-12px_rgba(0,0,0,.8)] backdrop-blur transition-colors hover:bg-[#0b1a33] focus-visible:outline-2 focus-visible:outline-[#037ef3]"
          >
            <List size={15} /> <span className="max-md:hidden">Show as list</span>
            <span className="md:hidden">List</span>
          </button>
        </div>

        {/* only once you are inside: how to walk, and the rooms */}
        <div ref={uiRef} className="invisible opacity-0 transition-opacity duration-300">
          {!lite && (
            <p
              className={`pointer-events-none absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#037ef3] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_0_24px_rgba(3,126,243,.55)] transition-opacity duration-500 ${started ? 'opacity-0' : 'opacity-100'}`}
            >
              <MoveHorizontal size={15} /> Scroll or swipe to walk through
            </p>
          )}

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

          {lite ? (
            // phones: one card that reads the story in front of you, with the rooms above it
            <div className="absolute right-[76px] bottom-3 left-3 rounded-[20px] bg-[#0b1a33]/90 px-2.5 pt-2.5 pb-2 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/10 backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onList}
                  aria-label="Show as list"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 focus-visible:outline-2 focus-visible:outline-[#ffc845]"
                >
                  <List size={15} />
                </button>
                <nav
                  ref={chipsRef}
                  aria-label="Rooms of the house"
                  className="flex min-w-0 flex-1 [scrollbar-width:none] gap-1 overflow-x-auto whitespace-nowrap"
                >
                  {stops.map((st, i) => (
                    <button
                      key={st.name}
                      data-room={i}
                      type="button"
                      onClick={() =>
                        goTo(
                          points.findIndex((p) => p.kind === 'title' && p.title.text === st.name),
                        )
                      }
                      className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#ffc845]"
                      style={
                        i === active
                          ? { background: '#037ef3', color: '#ffffff' }
                          : { background: 'transparent', color: 'rgba(255,255,255,.7)' }
                      }
                      aria-current={i === active ? 'true' : undefined}
                    >
                      <span className="size-1.5 rounded-full" style={{ background: st.color }} />
                      {st.name}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goTo(at - 1)}
                  disabled={at === 0}
                  aria-label="Previous"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/80 transition-opacity focus-visible:outline-2 focus-visible:outline-[#ffc845] disabled:opacity-25"
                >
                  <ChevronLeft size={20} />
                </button>
                <div
                  className="flex min-h-[86px] min-w-0 flex-1 flex-col justify-center py-0.5"
                  aria-live="polite"
                >
                  {point.kind === 'intro' && (
                    <>
                      <span className="text-[10px] font-bold tracking-[0.2em] text-[#e6c98f] uppercase">
                        Welcome in
                      </span>
                      <span className="font-museum mt-0.5 text-[16px] leading-[1.2] text-[#f4efe6]">
                        {frames.length} stories in {stops.length} rooms
                      </span>
                      <span className="mt-1 text-[12px] text-white/55">
                        Swipe or scroll to walk through
                      </span>
                    </>
                  )}
                  {point.kind === 'title' && (
                    <>
                      <span className="text-[10px] font-bold tracking-[0.2em] text-[#e6c98f] uppercase">
                        Room {String(point.title.index).padStart(2, '0')} of{' '}
                        {String(stops.length).padStart(2, '0')}
                      </span>
                      <span className="font-museum mt-0.5 text-[18px] leading-[1.15] text-[#f4efe6]">
                        {point.title.text}
                      </span>
                      <span className="mt-1 text-[12px] text-white/55">
                        {point.title.count} {point.title.count === 1 ? 'story' : 'stories'} in this
                        room
                      </span>
                    </>
                  )}
                  {point.kind === 'frame' && (
                    <button
                      type="button"
                      onClick={() => openFrame(point.frame)}
                      className="block min-w-0 text-left focus-visible:outline-2 focus-visible:outline-[#ffc845]"
                    >
                      <span
                        className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.16em] uppercase"
                        style={{ color: categoryColor(point.frame.post.category) }}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: categoryColor(point.frame.post.category) }}
                        />
                        <span className="truncate">{point.frame.post.category}</span>
                        <span className="ml-auto shrink-0 text-white/40">
                          {point.index + 1} / {frames.length}
                        </span>
                      </span>
                      <span className="font-museum mt-0.5 line-clamp-2 block text-[15px] leading-[1.22] text-[#f4efe6]">
                        {point.frame.post.title}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[12px] text-white/55">
                        <span className="min-w-0 truncate">
                          {point.frame.post.author_name} · {point.frame.post.read_time} min
                        </span>
                        <span className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full bg-[#037ef3] px-2.5 py-1 text-[11px] font-semibold text-white">
                          Read <ChevronRight size={12} />
                        </span>
                      </span>
                    </button>
                  )}
                  {point.kind === 'empty' && (
                    <>
                      <span className="text-[10px] font-bold tracking-[0.2em] text-[#e6c98f] uppercase">
                        Your page
                      </span>
                      <span className="font-museum mt-0.5 text-[16px] leading-[1.2] text-[#f4efe6]">
                        This frame is saved for your story.
                      </span>
                      <button
                        type="button"
                        onClick={onWrite}
                        className="mt-1.5 self-start rounded-full bg-[#ffc845] px-3 py-1 text-[12px] font-semibold text-[#0b1a33]"
                      >
                        Write yours
                      </button>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => goTo(at + 1)}
                  disabled={at === points.length - 1}
                  aria-label="Next"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/80 transition-opacity focus-visible:outline-2 focus-visible:outline-[#ffc845] disabled:opacity-25"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="mx-2 mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/15">
                <div
                  ref={barRef}
                  className="h-full origin-left scale-x-0 rounded-full bg-[#ffc845]"
                />
              </div>
            </div>
          ) : (
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
          )}
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

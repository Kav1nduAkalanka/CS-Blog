import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import createGlobe, { type Globe } from 'cobe'
import { Play } from 'lucide-react'
import type { BlogPost } from '../../lib/database.types'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { categoryColor } from './storyUtils'
import { HOME, groupByDestination, type Destination } from './destinations'

/* A slowly turning globe with a flight path from Colombo to every place a
   story happened. Faces are HTML buttons laid over the WebGL canvas, moved
   every frame with the same projection cobe uses, so they stay on their dots,
   work in every browser and can be tabbed to. */

const { PI, sin, cos, min, max } = Math
const ELEVATION = 0.02 // cobe markerElevation
const RADIUS = 0.8 + ELEVATION // cobe globe radius is 0.8
const TILT = 0.28
const SPIN = 0.12 // radians per second

/** Same maths as cobe's internal projection, for a square canvas. */
function project(lat: number, lng: number, phi: number, theta: number) {
  const la = (lat * PI) / 180
  const lo = (lng * PI) / 180 - PI
  const p = [-cos(la) * cos(lo) * RADIUS, sin(la) * RADIUS, cos(la) * sin(lo) * RADIUS]
  const ct = cos(theta)
  const st = sin(theta)
  const cp = cos(phi)
  const sp = sin(phi)
  const x = cp * p[0] + sp * p[2]
  const y = sp * st * p[0] + ct * p[1] - cp * st * p[2]
  const z = -sp * ct * p[0] + st * p[1] + cp * ct * p[2]
  return { x: (x + 1) / 2, y: (1 - y) / 2, z: z / RADIUS }
}

/** The phi that turns a longitude to face the viewer. */
const facing = (lng: number) => 1.5 * PI - (lng * PI) / 180

/** Shortest signed angle from a to b. */
const turn = (a: number, b: number) => ((((b - a) % (2 * PI)) + 3 * PI) % (2 * PI)) - PI

const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

interface StoryGlobeProps {
  posts: BlogPost[]
  onOpen: (post: BlogPost) => void
  /** stories with no place abroad, reached from the Colombo pin */
  homeCount?: number
  onHome?: () => void
}

export function StoryGlobe({ posts, onOpen, homeCount = 0, onHome }: StoryGlobeProps) {
  const reduced = useReducedMotion()
  const [supported] = useState(hasWebGL)
  const [active, setActive] = useState<number | null>(null)
  const destinations = useMemo(() => groupByDestination(posts), [posts])
  const storyCount = destinations.reduce((n, d) => n + d.posts.length, 0)

  const boxRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const homeRef = useRef<HTMLDivElement>(null)
  const pinRefs = useRef<(HTMLButtonElement | null)[]>([])
  const globeRef = useRef<Globe | null>(null)
  const destRef = useRef<Destination[]>([])
  const view = useRef({
    phi: facing(HOME.lng),
    theta: TILT,
    vel: 0,
    paused: false,
    active: null as number | null,
    target: null as number | null,
    drag: null as null | { x: number; y: number; phi: number; theta: number; t: number },
    shownArcs: -1,
    revealAt: 0,
  })

  /* create the globe once, drive it from one animation loop */
  useEffect(() => {
    const box = boxRef.current
    const host = hostRef.current
    if (!supported || !box || !host) return

    const dpr = min(2, window.devicePixelRatio || 1)
    let size = box.clientWidth
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size * dpr
    canvas.style.cssText = 'width:100%;height:100%;display:block'
    host.append(canvas)

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi: view.current.phi,
      theta: view.current.theta,
      dark: 1,
      diffuse: 1.4,
      mapSamples: 16000,
      mapBrightness: 5,
      baseColor: [0.2, 0.32, 0.56],
      markerColor: hex('#ffc845'),
      glowColor: [0.1, 0.32, 0.7],
      markers: [],
      arcs: [],
      arcColor: hex('#ffc845'),
      arcWidth: 0.5,
      arcHeight: 0.28,
      markerElevation: ELEVATION,
    })
    globeRef.current = globe

    const ro = new ResizeObserver(() => {
      size = box.clientWidth
      canvas.width = canvas.height = size * dpr
      globe.update({ width: size * dpr, height: size * dpr })
    })
    ro.observe(box)

    // stop drawing while scrolled away or in a background tab
    let onScreen = true
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting))
    io.observe(box)

    let raf = 0
    let last = performance.now()
    const place = (
      el: HTMLElement | null,
      lat: number,
      lng: number,
      shown: boolean,
      lift = false,
    ) => {
      if (!el) return
      const v = view.current
      const p = project(lat, lng, v.phi, v.theta)
      const fade = shown ? max(0, min(1, (p.z + 0.02) / 0.22)) : 0
      el.style.transform = `translate3d(${p.x * size}px, ${p.y * size}px, 0) translate(-50%, -50%) scale(${0.6 + fade * 0.4})`
      el.style.opacity = String(fade)
      el.style.zIndex = String(lift ? 300 : 100 + Math.round(p.z * 100))
      el.style.pointerEvents = fade > 0.5 ? 'auto' : 'none'
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!onScreen || document.hidden) {
        last = now
        return
      }
      const dt = min(0.064, (now - last) / 1000)
      last = now
      const v = view.current
      const dests = destRef.current

      if (!v.drag) {
        if (v.target !== null) {
          // bring a focused pin round to the front
          v.phi += turn(v.phi, v.target) * min(1, dt * 5)
          v.theta += (TILT - v.theta) * min(1, dt * 4)
        } else {
          v.phi += v.vel * dt
          v.vel *= 0.94
          v.theta += (TILT - v.theta) * min(1, dt * 1.5)
          if (!reduced && !v.paused) v.phi += SPIN * dt
        }
      }

      // flight paths draw in one after another
      const arcs = reduced
        ? dests.length
        : max(0, min(dests.length, Math.floor((now - v.revealAt) / 450)))
      if (arcs !== v.shownArcs) {
        v.shownArcs = arcs
        globe.update({
          arcs: dests.slice(0, arcs).map((d) => ({
            from: [HOME.lat, HOME.lng] as [number, number],
            to: [d.place.lat, d.place.lng] as [number, number],
          })),
          markers: [
            { location: [HOME.lat, HOME.lng], size: 0.07 },
            ...dests.slice(0, arcs).map((d) => ({
              location: [d.place.lat, d.place.lng] as [number, number],
              size: 0.045,
              color: hex(categoryColor(d.posts[0].category)),
            })),
          ],
        })
      }

      globe.update({ phi: v.phi, theta: v.theta })
      place(homeRef.current, HOME.lat, HOME.lng, true)
      dests.forEach((d, i) =>
        place(pinRefs.current[i], d.place.lat, d.place.lng, i < arcs, v.active === i),
      )
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      globe.destroy()
      globeRef.current = null
      host.replaceChildren()
    }
  }, [supported, reduced])

  /* new stories: redraw the flight paths from the start */
  useEffect(() => {
    destRef.current = destinations
    view.current.shownArcs = -1
    view.current.revealAt = performance.now() + 500
  }, [destinations])

  if (!supported) return null

  /* drag to spin (horizontal on touch, so the page still scrolls) */
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const v = view.current
    e.currentTarget.setPointerCapture(e.pointerId)
    v.target = null
    v.drag = { x: e.clientX, y: e.clientY, phi: v.phi, theta: v.theta, t: performance.now() }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const v = view.current
    const d = v.drag
    const size = boxRef.current?.clientWidth ?? 400
    if (!d) return
    const prev = v.phi
    v.phi = d.phi + ((e.clientX - d.x) / size) * PI
    if (e.pointerType === 'mouse')
      v.theta = max(-0.3, min(0.9, d.theta + ((e.clientY - d.y) / size) * PI * 0.6))
    const now = performance.now()
    v.vel = ((v.phi - prev) / max(1, now - d.t)) * 1000 * 0.6
    d.t = now
  }
  const onPointerUp = () => {
    view.current.drag = null
  }

  /* hovering or focusing a pin stops the spin and shows its card; keyboard
     focus also turns the pin to the front (not mouse focus, or the pin would
     slide out from under the cursor before the click lands) */
  const pauseOn = (i: number | null, bringToFront = false) => {
    const v = view.current
    setActive(i)
    v.paused = i !== null
    v.active = i
    v.target = bringToFront && i !== null ? facing(destinations[i].place.lng) : null
  }
  const focusedPin = () => {
    const i = pinRefs.current.findIndex((el) => el !== null && el === document.activeElement)
    return i < 0 ? null : i
  }

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      {/* soft glow behind the globe */}
      <div className="pointer-events-none absolute inset-[8%] rounded-full bg-[#037ef3]/30 blur-3xl" />

      <div ref={boxRef} className="relative aspect-square w-full select-none">
        <div
          ref={hostRef}
          className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden="true"
        />

        {/* pins */}
        <div className="pointer-events-none absolute inset-0">
          <div
            ref={homeRef}
            className="absolute top-0 left-0 flex flex-col items-center"
            style={{ opacity: 0 }}
          >
            <span className="relative flex size-3">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#ffc845] opacity-75 motion-reduce:animate-none" />
              <span className="relative size-3 rounded-full border-2 border-[#10213f] bg-[#ffc845]" />
            </span>
            {homeCount > 0 && onHome ? (
              <button
                type="button"
                onClick={onHome}
                // hold the globe still so the button does not drift away from the cursor
                onPointerEnter={() => (view.current.paused = true)}
                onPointerLeave={() => (view.current.paused = view.current.active !== null)}
                onFocus={() => (view.current.paused = true)}
                onBlur={() => (view.current.paused = view.current.active !== null)}
                className="mt-1.5 rounded-full border border-[#ffc845]/50 bg-[#10213f]/85 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-[#ffc845] backdrop-blur transition-colors hover:bg-[#ffc845] hover:text-[#10213f] focus-visible:outline-2 focus-visible:outline-[#ffc845]"
              >
                Colombo · {homeCount} {homeCount === 1 ? 'story' : 'stories'} from home ↓
              </button>
            ) : (
              <span className="mt-1.5 rounded-full bg-[#10213f]/80 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#ffc845] backdrop-blur">
                Colombo
              </span>
            )}
          </div>

          {destinations.map((d, i) => {
            const post = d.posts[0]
            const color = categoryColor(post.category)
            const open = active === i
            return (
              <button
                key={d.place.country}
                ref={(el) => {
                  pinRefs.current[i] = el
                }}
                type="button"
                onClick={() => onOpen(post)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && pauseOn(i)}
                onPointerLeave={() => pauseOn(focusedPin())}
                onFocus={(e) => pauseOn(i, e.currentTarget.matches(':focus-visible'))}
                onBlur={() => pauseOn(null)}
                className="group absolute top-0 left-0 rounded-full transition-opacity duration-300 focus-visible:outline-none"
                style={{ opacity: 0 }}
                aria-label={`${d.place.country}: watch ${post.author_name}'s story, ${post.title}`}
              >
                <span
                  className="block rounded-full p-[2px] shadow-[0_6px_20px_rgba(0,0,0,.45)] transition-transform duration-200 group-hover:scale-110 group-focus-visible:scale-110"
                  style={{ background: `conic-gradient(${color}, #ffc845, ${color})` }}
                >
                  {post.author_avatar_url ? (
                    <img
                      src={post.author_avatar_url}
                      alt=""
                      draggable={false}
                      className="size-10 rounded-full border-2 border-[#10213f] object-cover md:size-11"
                    />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-full border-2 border-[#10213f] bg-[#10213f] text-[15px] font-bold text-white md:size-11">
                      {post.author_name.charAt(0)}
                    </span>
                  )}
                </span>
                {d.posts.length > 1 && (
                  <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#ffc845] text-[11px] font-bold text-[#10213f]">
                    {d.posts.length}
                  </span>
                )}

                {/* preview card */}
                <span
                  className={`absolute bottom-full left-1/2 mb-3 w-[220px] -translate-x-1/2 overflow-hidden rounded-[12px] bg-white text-left text-[#10213f] shadow-2xl transition-all duration-200 ${
                    open
                      ? 'translate-y-0 opacity-100'
                      : 'pointer-events-none translate-y-1 opacity-0'
                  }`}
                  aria-hidden="true"
                >
                  {post.cover_image_url && (
                    <img
                      src={post.cover_image_url}
                      alt=""
                      draggable={false}
                      className="h-24 w-full object-cover"
                    />
                  )}
                  <span className="block p-3">
                    <span
                      className="block text-[11px] font-bold tracking-wide uppercase"
                      style={{ color }}
                    >
                      {d.place.city}, {d.place.country}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[14px] leading-[1.3] font-semibold">
                      {post.title}
                    </span>
                    <span className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#037ef3]">
                      <Play size={12} fill="currentColor" /> Watch {post.author_name.split(' ')[0]}
                      's story
                    </span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {destinations.length > 0 && (
        <p className="relative mt-2 text-center text-[13px] text-white/70">
          <span className="font-semibold text-white">
            {destinations.length} {destinations.length === 1 ? 'country' : 'countries'}
          </span>
          , {storyCount} {storyCount === 1 ? 'story' : 'stories'} abroad, every flight from Colombo.
          <span className="block text-white/50">Drag to spin. Tap a face to watch.</span>
        </p>
      )}
    </div>
  )
}

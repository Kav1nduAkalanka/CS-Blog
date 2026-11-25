import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useMotionValueEvent, type MotionValue } from 'motion/react'

/* The outside of the Story House, at dusk, lit from inside.

   As `progress` goes from 0 to 1 the glass doors slide open and the camera
   walks up the path and through the doorway; once the doorway fills most of
   the view, the house dissolves into the real corridor behind it.

   For smooth scrolling every depth layer is its own element that the browser
   moves and scales on the GPU: nothing in the drawing is redrawn while you
   walk.

   The scene is built in depth layers (sky, skyline, palms, house, foreground
   plants). Each layer grows at its own rate as the camera walks in, so it
   feels like stepping forward rather than zooming into a flat picture. */

// the doorway, in the drawing's units (1600 x 1000)
const DX = 740
const DY = 470
const DW = 120
const DH = 290
const CX = DX + DW / 2
const CY = DY + DH / 2
const GROUND = 760
const MAX_ZOOM = 15

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const easeIn = (t: number) => t * t * t

// how fast each layer grows as you walk in
const DEPTH = {
  sky: 0.08,
  palms: 0.45,
  house: 1,
  front: 1.45,
} as const
type Layer = keyof typeof DEPTH

// a fixed, seeded scatter so the stars and lit windows don't move between renders
function scatter(n: number, seed: number) {
  let x = seed
  const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280
  return Array.from({ length: n }, () => [rnd(), rnd(), rnd()] as const)
}
const STARS = scatter(70, 7)
const TOWERS = scatter(26, 3)

/** Light that switches on shortly after you arrive. */
function LightsOn({ delay, children }: { delay: number; children: ReactNode }) {
  return <g style={{ animation: `hf-on 0.8s ease-out ${delay * 0.55}s both` }}>{children}</g>
}

function Palm({
  x,
  h,
  lean,
  flip = false,
}: {
  x: number
  h: number
  lean: number
  flip?: boolean
}) {
  const top = { x: x + lean, y: GROUND - h }
  const fronds = [-150, -120, -95, -70, -40, -15, 10, 35]
  return (
    <g transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}>
      <path
        d={`M${x - 9} ${GROUND} Q${x + lean * 0.2} ${GROUND - h * 0.55} ${top.x - 4} ${top.y} L${top.x + 4} ${top.y} Q${x + lean * 0.2 + 8} ${GROUND - h * 0.55} ${x + 9} ${GROUND}Z`}
        fill="#0d1a33"
      />
      {fronds.map((a) => {
        // a drooping, leaf-shaped frond: wide in the middle, pointed at the tip
        const r = (a * Math.PI) / 180
        const len = 130 + Math.abs(Math.cos(r)) * 40
        const ex = top.x + Math.cos(r) * len
        const ey = top.y + Math.sin(r) * len * 0.45 + 46 + Math.abs(Math.cos(r)) * 34
        const mx = (top.x + ex) / 2
        const my = (top.y + ey) / 2 - 34
        const nx = -(ey - top.y) / len
        const ny = (ex - top.x) / len
        const wv = 16
        return (
          <path
            key={a}
            d={`M${top.x} ${top.y} Q${mx + nx * wv} ${my + ny * wv} ${ex} ${ey} Q${mx - nx * wv} ${my - ny * wv} ${top.x} ${top.y}Z`}
            fill="#0d1a33"
          />
        )
      })}
      <circle cx={top.x} cy={top.y + 4} r="9" fill="#0d1a33" />
    </g>
  )
}

/** A big window with the lit room behind it: oak floor, downlights, story photos on the wall. */
function Window({
  x,
  y,
  w,
  h,
  covers,
}: {
  x: number
  y: number
  w: number
  h: number
  covers: string[]
}) {
  const pw = w * 0.3
  const ph = pw * 1.18
  const py = y + h * 0.26
  const slots = [x + w * 0.12, x + w * 0.58]
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="url(#hf-room)" />
      <rect x={x} y={y + h * 0.82} width={w} height={h * 0.18} fill="url(#hf-oak)" />
      {/* downlights, and the pools they throw on the back wall */}
      {slots.map((sx, i) => (
        <g key={i}>
          <ellipse cx={sx + pw / 2} cy={y + 8} rx="10" ry="3" fill="#fff" />
          <ellipse
            cx={sx + pw / 2}
            cy={py + ph * 0.3}
            rx={pw * 0.95}
            ry={ph * 0.9}
            fill="url(#hf-pool)"
          />
          <rect x={sx - 4} y={py - 4} width={pw + 8} height={ph + 8} fill="#fff" />
          {covers[i] ? (
            <image
              href={covers[i]}
              x={sx}
              y={py}
              width={pw}
              height={ph}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <rect x={sx} y={py} width={pw} height={ph} fill="#037ef3" />
          )}
        </g>
      ))}
      {/* the glass: dusk sky reflected at the top, a diagonal glint */}
      <rect x={x} y={y} width={w} height={h} fill="url(#hf-reflect)" />
      <path
        d={`M${x + w * 0.1} ${y} L${x + w * 0.42} ${y} L${x + w * 0.12} ${y + h} L${x} ${y + h} L${x} ${y + h * 0.7}Z`}
        fill="#fff"
        opacity=".08"
      />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#0b1a33" strokeWidth="7" />
      <rect x={x + w / 2 - 2} y={y} width="4" height={h} fill="#0b1a33" />
    </g>
  )
}

/** Which part of the drawing to show. Wide screens see all of it; a tall phone sees
    the whole front of the house, with more sky above and lawn below. */
function viewFor(w: number, h: number): [number, number, number, number] {
  if (w / h >= 0.9) return [0, 0, 1600, 1000]
  const bw = 900
  const bh = (bw * h) / w
  return [CX - bw / 2, CY - 0.58 * bh, bw, bh]
}

/** One depth layer: its own element, so the browser can move and scale it on the GPU
    without redrawing the drawing inside it. */
function Plane({
  layerRef,
  vb,
  children,
  className = '',
}: {
  layerRef: React.Ref<HTMLDivElement>
  vb: string
  children: ReactNode
  className?: string
}) {
  return (
    <div ref={layerRef} className={`absolute inset-0 will-change-transform ${className}`}>
      <svg className="size-full" viewBox={vb} preserveAspectRatio="xMidYMid slice">
        {children}
      </svg>
    </div>
  )
}

export function HouseFacade({
  progress,
  covers = [],
  onEnter,
}: {
  progress: MotionValue<number>
  /** story photos to hang inside the rooms you can see through the windows */
  covers?: string[]
  /** clicking the door */
  onEnter?: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const skyRef = useRef<HTMLDivElement>(null)
  const palmsRef = useRef<HTMLDivElement>(null)
  const houseRef = useRef<HTMLDivElement>(null)
  const frontRef = useRef<HTMLDivElement>(null)
  const interiorRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLParagraphElement>(null)
  const hover = useRef(false)
  // where the doorway's centre is on screen, and how big one drawing unit is
  const frame = useRef({ cx: 0, cy: 0, k: 1 })
  const [doorHover, setDoorHover] = useState(false)
  const [vb, setVb] = useState(() => viewFor(window.innerWidth, window.innerHeight).join(' '))

  const measure = () => {
    const el = rootRef.current
    if (!el) return
    const w = el.clientWidth
    const h = el.clientHeight
    const [bx, by, bw, bh] = viewFor(w, h)
    const k = Math.max(w / bw, h / bh) // the drawing covers the screen ("slice")
    frame.current = {
      cx: (w - bw * k) / 2 + (CX - bx) * k,
      cy: (h - bh * k) / 2 + (CY - by) * k,
      k,
    }
    const origin = `${frame.current.cx}px ${frame.current.cy}px`
    for (const r of [skyRef, palmsRef, interiorRef, leftRef, rightRef, houseRef, frontRef]) {
      if (r.current) r.current.style.transformOrigin = origin
    }
  }

  const paint = (e: number) => {
    const { k } = frame.current
    // doors part a little when you point at them, all the way as you walk up
    const open = Math.max(clamp((e - 0.06) / 0.26), hover.current ? 0.16 : 0)
    const walk = easeIn(clamp((e - 0.28) / 0.72))
    const z = Math.exp(Math.log(MAX_ZOOM) * walk)
    const refs = { sky: skyRef, palms: palmsRef, house: houseRef, front: frontRef }
    for (const name of Object.keys(DEPTH) as Layer[]) {
      const el = refs[name].current
      if (!el) continue
      const sc = z ** DEPTH[name]
      el.style.transform = `scale(${sc.toFixed(4)})`
      if (name === 'house') {
        // the corridor and the doors travel with the house; the doors also slide apart
        const slide = (DW / 2) * open * k * sc
        const at = (dx: number) => `translate3d(${dx.toFixed(1)}px, 0, 0) scale(${sc.toFixed(4)})`
        if (interiorRef.current) interiorRef.current.style.transform = at(0)
        if (leftRef.current) leftRef.current.style.transform = at(-slide)
        if (rightRef.current) rightRef.current.style.transform = at(slide)
      }
    }
    if (hintRef.current) hintRef.current.style.opacity = String(1 - clamp(e / 0.08))
    if (rootRef.current) {
      // once the doorway fills most of the view, the house dissolves into the corridor
      rootRef.current.style.opacity = String(1 - clamp((e - 0.7) / 0.24))
      rootRef.current.style.visibility = e >= 0.94 ? 'hidden' : 'visible'
    }
  }
  useMotionValueEvent(progress, 'change', paint)
  useLayoutEffect(() => {
    measure()
    paint(progress.get())
  })
  useEffect(() => {
    const onResize = () => {
      const el = rootRef.current
      if (el) setVb(viewFor(el.clientWidth, el.clientHeight).join(' '))
      measure()
      paint(progress.get())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  const setHover = (on: boolean) => {
    hover.current = on
    setDoorHover(on)
    paint(progress.get())
  }

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 overflow-hidden will-change-[opacity]"
      aria-hidden="true"
    >
      {/* shared gradients and filters for all the layers */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="hf-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1b42" />
            <stop offset=".38" stopColor="#23468a" />
            <stop offset=".6" stopColor="#7b6fa8" />
            <stop offset=".72" stopColor="#ec8f6a" />
            <stop offset=".79" stopColor="#ffc785" />
          </linearGradient>
          <radialGradient id="hf-sun" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#fff2c9" stopOpacity=".95" />
            <stop offset=".35" stopColor="#ffc785" stopOpacity=".55" />
            <stop offset="1" stopColor="#ff9d6b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hf-room" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d9b887" />
            <stop offset=".18" stopColor="#fbe7c4" />
            <stop offset=".8" stopColor="#fff3df" />
          </linearGradient>
          <linearGradient id="hf-hall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#060c18" />
            <stop offset=".25" stopColor="#13233f" />
            <stop offset=".78" stopColor="#0e1a31" />
            <stop offset=".8" stopColor="#3a2a1d" />
            <stop offset="1" stopColor="#1a120c" />
          </linearGradient>
          <linearGradient id="hf-oak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c99a62" />
            <stop offset="1" stopColor="#8a6238" />
          </linearGradient>
          <radialGradient id="hf-pool" cx=".5" cy=".2" r=".6">
            <stop offset="0" stopColor="#fff" stopOpacity=".9" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hf-reflect" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#23468a" stopOpacity=".55" />
            <stop offset=".35" stopColor="#7b6fa8" stopOpacity=".12" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hf-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9cfdc" />
            <stop offset=".5" stopColor="#e9e4e0" />
            <stop offset="1" stopColor="#f6e6d2" />
          </linearGradient>
          <linearGradient id="hf-side" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#aab3c6" />
            <stop offset="1" stopColor="#d9cfc4" />
          </linearGradient>
          <linearGradient id="hf-lawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f5a3f" />
            <stop offset="1" stopColor="#14301f" />
          </linearGradient>
          <linearGradient id="hf-path" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d8c3a6" />
            <stop offset="1" stopColor="#7c7064" />
          </linearGradient>
          <linearGradient id="hf-spill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd59a" stopOpacity=".7" />
            <stop offset="1" stopColor="#ffd59a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hf-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1d4" stopOpacity=".85" />
            <stop offset="1" stopColor="#fff1d4" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hf-wood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8a5a32" />
            <stop offset="1" stopColor="#c48a52" />
          </linearGradient>
          <filter id="hf-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="hf-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id="hf-dof" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
      </svg>

      <Plane vb={vb} layerRef={skyRef}>
        <rect x="-2000" y="-2500" width="5600" height="5000" fill="url(#hf-sky)" />
        <circle cx="1180" cy="720" r="260" fill="url(#hf-sun)" />
        {STARS.map(([a, b, c], i) => (
          <circle
            key={i}
            cx={a * 1700 - 50}
            cy={b * 420}
            r={0.8 + c * 1.4}
            fill="#fff"
            opacity={0.5 + c * 0.5}
          />
        ))}
        <g fill="#ffd7c2" opacity=".55" filter="url(#hf-blur)">
          <ellipse cx="240" cy="420" rx="170" ry="26" />
          <ellipse cx="380" cy="400" rx="120" ry="22" />
          <ellipse cx="1260" cy="470" rx="190" ry="24" />
          <ellipse cx="1000" cy="300" rx="150" ry="20" />
        </g>
      </Plane>
      {/* Colombo's skyline far off, windows lit, and palms in front of it */}
      <Plane vb={vb} layerRef={palmsRef}>
        {TOWERS.map(([a, b, c], i) => {
          const w = 30 + c * 50
          const x = -200 + i * 78 + a * 20
          const h = 60 + b * 170
          return (
            <g key={i}>
              <rect x={x} y={GROUND - h} width={w} height={h} fill="#22335e" />
              {Array.from({ length: Math.floor(h / 22) }, (_, r) =>
                Array.from({ length: Math.floor(w / 14) }, (_, k) =>
                  (r * 7 + k * 3 + i) % 5 === 0 ? (
                    <rect
                      key={`${r}-${k}`}
                      x={x + 5 + k * 14}
                      y={GROUND - h + 8 + r * 22}
                      width="5"
                      height="7"
                      fill="#ffd28a"
                      opacity=".8"
                    />
                  ) : null,
                ),
              )}
            </g>
          )
        })}
        <Palm x={250} h={420} lean={40} />
        <Palm x={140} h={330} lean={-30} />
        <Palm x={1390} h={440} lean={-45} flip />
        <Palm x={1500} h={340} lean={30} flip />
      </Plane>

      {/* behind the house: the bright corridor through the doorway, and the two glass
          doors, each its own layer, so sliding them open is only a move on the GPU */}
      <Plane vb={vb} layerRef={interiorRef}>
        <rect x={DX} y={DY} width={DW} height={DH} fill="url(#hf-hall)" />
        <rect x={DX} y={DY + DH * 0.78} width={DW} height="2" fill="#037ef3" opacity=".7" />
        <rect
          x={DX + 24}
          y={DY + 90}
          width="22"
          height="26"
          fill="#fff"
          stroke="#c9d2de"
          strokeWidth="1.5"
        />
        <rect
          x={DX + 74}
          y={DY + 96}
          width="18"
          height="22"
          fill="#fff"
          stroke="#c9d2de"
          strokeWidth="1.5"
        />
      </Plane>
      <Plane vb={vb} layerRef={leftRef}>
        <rect
          x={DX}
          y={DY}
          width={DW / 2}
          height={DH}
          fill="#ffe2b0"
          fillOpacity={doorHover ? 0.1 : 0.22}
        />
        <rect
          x={DX}
          y={DY}
          width={DW / 2}
          height={DH}
          fill="none"
          stroke="#0b1a33"
          strokeWidth="5"
        />
        <rect x={DX + DW / 2 - 12} y={DY + 120} width="4" height="60" rx="2" fill="#0b1a33" />
        <path
          d={`M${DX + 8} ${DY + 10} L${DX + 30} ${DY + 10} L${DX + 12} ${DY + 120}Z`}
          fill="#fff"
          opacity=".3"
        />
      </Plane>
      <Plane vb={vb} layerRef={rightRef}>
        <rect
          x={CX}
          y={DY}
          width={DW / 2}
          height={DH}
          fill="#ffe2b0"
          fillOpacity={doorHover ? 0.1 : 0.22}
        />
        <rect
          x={CX}
          y={DY}
          width={DW / 2}
          height={DH}
          fill="none"
          stroke="#0b1a33"
          strokeWidth="5"
        />
        <rect x={CX + 8} y={DY + 120} width="4" height="60" rx="2" fill="#0b1a33" />
        <path
          d={`M${CX + 8} ${DY + 10} L${CX + 30} ${DY + 10} L${CX + 12} ${DY + 120}Z`}
          fill="#fff"
          opacity=".3"
        />
      </Plane>

      {/* the house, its lawn and path */}
      <Plane vb={vb} layerRef={houseRef}>
        <rect x="-2000" y={GROUND} width="5600" height="3000" fill="url(#hf-lawn)" />
        <path d={`M${DX - 24} ${GROUND}H${DX + DW + 24}L1150 1000H450Z`} fill="url(#hf-path)" />
        {/* warm light spilling out of the doorway onto the path */}
        <LightsOn delay={1}>
          <path d={`M${DX} ${GROUND}H${DX + DW}L1060 1000H540Z`} fill="url(#hf-spill)" />
        </LightsOn>
        <rect
          x="290"
          y={GROUND - 4}
          width="1040"
          height="16"
          fill="#000"
          opacity=".35"
          filter="url(#hf-glow)"
        />

        {/* left wing: timber slats, washed with light from below */}
        <rect x="300" y="430" width="250" height="330" fill="url(#hf-side)" />
        {Array.from({ length: 11 }, (_, i) => (
          <rect key={i} x={318 + i * 20} y="450" width="12" height="290" fill="url(#hf-wood)" />
        ))}
        <LightsOn delay={0.5}>
          {[360, 490].map((x) => (
            <ellipse
              key={x}
              cx={x}
              cy="700"
              rx="60"
              ry="120"
              fill="#ffcf8a"
              opacity=".35"
              filter="url(#hf-blur)"
            />
          ))}
        </LightsOn>
        <rect x="280" y="404" width="290" height="28" rx="3" fill="#0b1a33" />

        {/* right wing with its picture window */}
        <rect x="1050" y="390" width="270" height="370" fill="url(#hf-side)" />
        <Window x={1072} y={420} w={226} h={310} covers={covers.slice(4, 6)} />
        <rect x="1040" y="362" width="300" height="30" rx="3" fill="#0b1a33" />

        {/* main volume, the doorway cut through it */}
        <path
          d={`M520 330H1080V760H520z M${DX} ${DY}h${DW}v${DH}h${-DW}z`}
          fill="url(#hf-wall)"
          fillRule="evenodd"
        />
        <Window x={560} y={390} w={155} h={350} covers={covers.slice(0, 2)} />
        <Window x={885} y={390} w={155} h={350} covers={covers.slice(2, 4)} />

        {/* roof slab, its blue light line, and soffit lights washing the wall */}
        <rect x="480" y="296" width="640" height="42" rx="3" fill="#0b1a33" />
        <LightsOn delay={0.2}>
          <rect x="480" y="336" width="640" height="5" fill="#3d9bff" filter="url(#hf-glow)" />
          <rect x="480" y="337" width="640" height="3" fill="#8cc8ff" />
          {[600, 1000].map((x) => (
            <path
              key={x}
              d={`M${x - 14} 341 L${x + 14} 341 L${x + 60} 390 L${x - 60} 390Z`}
              fill="url(#hf-wash)"
            />
          ))}
        </LightsOn>
        <text
          x="800"
          y="324"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="Poppins, sans-serif"
          fontSize="17"
          fontWeight="600"
          letterSpacing="6"
        >
          AIESEC IN COLOMBO SOUTH
        </text>

        {/* backlit sign */}
        <LightsOn delay={0.8}>
          <rect
            x="676"
            y="394"
            width="248"
            height="60"
            rx="10"
            fill="#037ef3"
            opacity=".8"
            filter="url(#hf-glow)"
          />
        </LightsOn>
        <rect x="680" y="398" width="240" height="52" rx="8" fill="#037ef3" />
        <text
          x="800"
          y="432"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="Bricolage Grotesque, Poppins, sans-serif"
          fontSize="25"
          fontWeight="700"
        >
          The Story House
        </text>

        {/* canopy, its downlights, and wall lights either side of the door */}
        <rect x="712" y="456" width="176" height="9" rx="2" fill="#0b1a33" />
        <LightsOn delay={0.4}>
          {[748, 852].map((x) => (
            <ellipse key={x} cx={x} cy="470" rx="18" ry="7" fill="#fff3d6" filter="url(#hf-glow)" />
          ))}
          {[722, 878].map((x) => (
            <g key={x}>
              <path
                d={`M${x - 4} 560 L${x + 4} 560 L${x + 26} 500 L${x - 26} 500Z`}
                fill="url(#hf-wash)"
                transform={`rotate(180 ${x} 530)`}
              />
              <path
                d={`M${x - 4} 580 L${x + 4} 580 L${x + 26} 640 L${x - 26} 640Z`}
                fill="url(#hf-wash)"
              />
            </g>
          ))}
        </LightsOn>
        {[722, 878].map((x) => (
          <rect key={x} x={x - 5} y="560" width="10" height="20" rx="2" fill="#0b1a33" />
        ))}

        {/* sliding glass doors */}
        <rect
          x={DX - 5}
          y={DY - 5}
          width={DW + 10}
          height={DH + 5}
          fill="none"
          stroke="#0b1a33"
          strokeWidth="10"
        />

        {/* planters with uplights */}
        {[668, 932].map((x) => (
          <g key={x}>
            <LightsOn delay={0.6}>
              <ellipse
                cx={x}
                cy="690"
                rx="46"
                ry="70"
                fill="#ffcf8a"
                opacity=".3"
                filter="url(#hf-blur)"
              />
            </LightsOn>
            <circle cx={x - 10} cy="706" r="26" fill="#2d7a3a" />
            <circle cx={x + 12} cy="694" r="30" fill="#3f9a4a" />
            <circle cx={x} cy="676" r="22" fill="#5bb65f" />
            <rect x={x - 26} y="718" width="52" height="42" rx="4" fill="#0b1a33" />
          </g>
        ))}

        {/* bollard lights along the path */}
        {[
          [690, 800],
          [910, 800],
          [620, 880],
          [980, 880],
          [540, 970],
          [1060, 970],
        ].map(([x, y], i) => (
          <g key={i}>
            <LightsOn delay={1.2 + i * 0.12}>
              <ellipse
                cx={x}
                cy={y + 6}
                rx={26 + i * 4}
                ry={8 + i}
                fill="#ffd28a"
                opacity=".55"
                filter="url(#hf-glow)"
              />
            </LightsOn>
            <rect
              x={x - 4}
              y={y - 22 - i * 3}
              width={8}
              height={22 + i * 3}
              rx="2"
              fill="#0b1a33"
            />
            <rect x={x - 4} y={y - 22 - i * 3} width={8} height="5" fill="#ffe7b8" />
          </g>
        ))}

        {/* the door glows when you point at it */}
        <rect
          x={DX - 14}
          y={DY - 14}
          width={DW + 28}
          height={DH + 14}
          fill="none"
          stroke="#ffc845"
          strokeWidth="4"
          opacity={doorHover ? 0.9 : 0}
          filter="url(#hf-glow)"
          style={{ transition: 'opacity .3s' }}
        />
        {/* the door, as something to click (only while the house is showing) */}
        <rect
          x={DX - 10}
          y={DY - 10}
          width={DW + 20}
          height={DH + 10}
          fill="transparent"
          pointerEvents="visible"
          style={{ cursor: 'pointer' }}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          onClick={onEnter}
        />
      </Plane>

      {/* big leaves right in front of the camera, slightly out of focus */}
      <Plane vb={vb} layerRef={frontRef}>
        <g filter="url(#hf-dof)">
          <path d="M-60 1000 Q40 820 230 780 Q140 880 120 1000Z" fill="#0f2a1a" />
          <path d="M-40 1000 Q-30 860 90 740 Q80 880 60 1000Z" fill="#163a24" />
          <path d="M1660 1000 Q1560 830 1370 800 Q1460 890 1480 1000Z" fill="#0f2a1a" />
          <path d="M1640 1000 Q1630 870 1520 760 Q1530 890 1550 1000Z" fill="#163a24" />
        </g>
      </Plane>

      <p
        ref={hintRef}
        className="absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-[14px] font-semibold whitespace-nowrap text-[#0b1a33] shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] max-md:bottom-40"
      >
        <span className="size-2 animate-pulse rounded-full bg-[#037ef3]" />
        Scroll, or tap the door, to step inside
      </p>
    </div>
  )
}

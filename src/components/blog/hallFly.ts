/* The hand-off from the exhibition hall into a story. A copy of the clicked
   photo is put on top of everything, grows from where it hangs to fill the
   screen, and stays there while the story page loads underneath. Then it
   fades away, revealing the same photo as the story's full-screen cover. It
   lives on document.body, so it survives the route change. */

const RETURN_KEY = 'cs-hall-return'

export interface HallReturn {
  y: number
  id: string
}

export function saveHallReturn(value: HallReturn) {
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(value))
  } catch {
    /* private mode: the reader just lands at the top */
  }
}

export function takeHallReturn(): HallReturn | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return raw ? (JSON.parse(raw) as HallReturn) : null
  } catch {
    return null
  }
}

const EASE = 'cubic-bezier(.65,0,.35,1)'

export function flyIntoStory({
  from,
  src,
  background = '#f5f7fb',
  go,
}: {
  /** where the photo is on screen now */
  from: DOMRect
  src: string | null
  /** colour behind the photo while it travels */
  background?: string
  /** changes the route; called once the photo fills the screen */
  go: () => void
}) {
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '200',
    pointerEvents: 'none',
  })
  const shade = document.createElement('div')
  Object.assign(shade.style, { position: 'absolute', inset: '0', background, opacity: '0' })
  const pic = document.createElement('div')
  Object.assign(pic.style, {
    position: 'absolute',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    overflow: 'hidden',
    background: src
      ? `center / cover no-repeat url("${src}")`
      : 'linear-gradient(140deg,#037ef3,#10213f)',
    boxShadow: '0 30px 60px -20px rgba(40,25,5,.5)',
  })
  // the story cover starts under a dark veil, so the photo dims as it lands
  const veil = document.createElement('div')
  Object.assign(veil.style, {
    position: 'absolute',
    inset: '0',
    background: '#0b1830',
    opacity: '0',
  })
  pic.appendChild(veil)
  layer.append(shade, pic)
  document.body.appendChild(layer)

  const vw = window.innerWidth
  const vh = window.innerHeight
  const timing = { duration: 750, easing: EASE, fill: 'forwards' as const }
  shade.animate([{ opacity: 0 }, { opacity: 1 }], { ...timing, duration: 400 })
  pic.animate(
    [
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
      },
      { left: '0px', top: '0px', width: `${vw}px`, height: `${vh}px`, boxShadow: 'none' },
    ],
    timing,
  )
  const landing = veil.animate([{ opacity: 0 }, { opacity: 0.8 }], timing)

  landing.finished.then(() => {
    go()
    // give the story page time to mount under the copy, then reveal it
    window.setTimeout(() => {
      layer
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 600,
          easing: 'ease-out',
          fill: 'forwards',
        })
        .finished.then(() => layer.remove())
    }, 650)
  })
}

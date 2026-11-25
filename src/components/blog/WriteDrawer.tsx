import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, PenLine, X } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const PROMPTS = [
  'The first night in a country you had never seen',
  'A moment you led when nobody asked you to',
  'Something an exchange taught you that a classroom never could',
]

/** Slides in from the right, over the hall, when the reader clicks the empty frame. */
export function WriteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduced = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const back = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120]">
          <motion.button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 bg-[#1d1608]/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="write-drawer-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col overflow-y-auto bg-[#f6efe2] shadow-[-30px_0_60px_-30px_rgba(40,25,5,.6)]"
            initial={reduced ? { opacity: 0 } : { x: '100%' }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between px-7 pt-7">
              <p className="text-[11px] font-semibold tracking-[0.24em] text-[#8a6420] uppercase">
                Your page
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="flex size-10 items-center justify-center rounded-full bg-[#1d1608]/8 text-[#1d1608] transition-colors hover:bg-[#1d1608]/15 focus-visible:outline-2 focus-visible:outline-[#037ef3]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 px-7 pt-6 pb-10">
              <h2
                id="write-drawer-title"
                className="font-hand text-[52px] leading-[0.95] text-[#2a2117]"
              >
                Write your page.
              </h2>
              <p className="mt-4 text-[15px] leading-[1.7] text-[#1d1608]/75">
                You don't need to be a writer. Pick one moment, tell it honestly, and our team will
                help with editing and photos before it goes up in the house.
              </p>
              <p className="mt-8 text-[12px] font-semibold tracking-[0.16em] text-[#1d1608]/50 uppercase">
                Not sure where to start?
              </p>
              <ul className="mt-3 grid gap-2.5">
                {PROMPTS.map((p) => (
                  <li key={p}>
                    <Link
                      to="/blog/submit"
                      className="group flex items-center justify-between gap-3 rounded-[10px] border border-[#3c2a0f]/12 bg-[#fffaf0] px-4 py-3.5 text-[14px] text-[#1d1608] transition-colors hover:border-[#8a6420]/50 focus-visible:outline-2 focus-visible:outline-[#037ef3]"
                    >
                      {p}
                      <ArrowRight
                        size={15}
                        className="shrink-0 text-[#8a6420] transition-transform group-hover:translate-x-1"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to="/blog/submit"
                className="mt-8 flex items-center justify-center gap-2 rounded-full bg-[#10213f] px-6 py-3.5 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10213f]"
              >
                <PenLine size={17} /> Start writing
              </Link>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}

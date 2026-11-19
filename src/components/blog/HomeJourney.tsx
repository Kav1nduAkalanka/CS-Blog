import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import { ArrowRight, MapPin, PenLine, Plus } from 'lucide-react'
import type { BlogPost } from '../../lib/database.types'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { categoryColor, formatStoryDate, storyHighlights } from './storyUtils'

/* Stories with no trip abroad: leading a team, running an event, finding your
   people. Shown as stops along a road that starts in Colombo (the same home
   pin as the globe) and fills in as you scroll. */

function Station({ post, step }: { post: BlogPost; step: number }) {
  const reduced = useReducedMotion()
  const color = categoryColor(post.category)
  return (
    <motion.span
      className="relative z-10 block rounded-full p-[3px] shadow-[0_10px_30px_-10px_rgba(16,33,63,.5)]"
      style={{ background: `conic-gradient(from 200deg, ${color}, #ffc845, ${color})` }}
      initial={reduced ? false : { scale: 0.4, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16 }}
    >
      <span className="block rounded-full border-[3px] border-white">
        {post.author_avatar_url ? (
          <img
            src={post.author_avatar_url}
            alt=""
            className="size-[50px] rounded-full object-cover md:size-[64px]"
          />
        ) : (
          <span className="flex size-[50px] items-center justify-center rounded-full bg-[#10213f] text-[18px] font-bold text-white md:size-[64px]">
            {post.author_name.charAt(0)}
          </span>
        )}
      </span>
      <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-[#10213f] text-[11px] font-bold text-[#ffc845] ring-2 ring-white">
        {String(step).padStart(2, '0')}
      </span>
    </motion.span>
  )
}

function StopCard({ post, quote }: { post: BlogPost; quote: string | null }) {
  const color = categoryColor(post.category)
  return (
    <Link
      to={`/blog/${post.id}`}
      className="group focus-visible:outline-brand block overflow-hidden rounded-[18px] border border-[#e1e9f5] bg-white shadow-[0_24px_50px_-30px_rgba(16,33,63,.45)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-28px_rgba(16,33,63,.55)] focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <span className="relative block aspect-[16/9] overflow-hidden bg-[#10213f]">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
          />
        ) : (
          <span className="block size-full bg-[linear-gradient(140deg,#037ef3,#10213f)]" />
        )}
        <span
          className="absolute top-3 left-3 rounded-full px-3 py-1 text-[12px] font-semibold text-white"
          style={{ background: color }}
        >
          {post.category}
        </span>
      </span>
      <span className="block p-5 md:p-6">
        <span className="block text-[13px] text-[#10213f]/55">
          {formatStoryDate(post, 'long')}, {post.read_time} min read
        </span>
        <span className="font-display mt-1.5 block text-[22px] leading-[1.15] font-semibold text-balance text-[#10213f]">
          {post.title}
        </span>
        {/* on phones the quote has no side of its own, so it goes in the card */}
        {quote && (
          <span
            className="font-display mt-3 block border-l-[3px] pl-3 text-[16px] leading-[1.4] font-medium md:hidden"
            style={{ borderColor: color, color }}
          >
            “{quote}”
          </span>
        )}
        <span className="mt-3 line-clamp-2 block text-[15px] leading-[1.6] text-[#10213f]/70 max-md:hidden">
          {post.excerpt}
        </span>
        <span className="mt-4 flex items-center justify-between gap-3">
          <span className="truncate text-[14px] font-semibold text-[#10213f]">
            {post.author_name}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-[#037ef3]">
            Read the story
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </span>
        </span>
      </span>
    </Link>
  )
}

export function HomeJourney({ posts }: { posts: BlogPost[] }) {
  const reduced = useReducedMotion()
  const roadRef = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: roadRef, offset: ['start 75%', 'end 65%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 })
  const travellerTop = useTransform(progress, (v) => `${v * 100}%`)
  const quotes = useMemo(() => posts.map((p) => storyHighlights(p.content).quote), [posts])

  if (posts.length === 0) return null

  return (
    <section
      id="home-journey"
      className="relative scroll-mt-20 overflow-hidden bg-white px-6 py-20 md:px-10 md:py-28"
      style={{
        backgroundImage: 'radial-gradient(rgba(16,33,63,.07) 1px, transparent 1.5px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="relative mx-auto max-w-[1100px]">
        <div className="max-w-[640px] md:mx-auto md:text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#10213f] px-3.5 py-1.5 text-[13px] font-semibold text-[#ffc845]">
            <MapPin size={14} /> Home base: Colombo
          </span>
          <h2 className="font-display mt-5 text-[38px] leading-[1.05] font-bold tracking-[-0.02em] text-balance text-[#10213f] md:text-[56px]">
            Not every journey needs a passport.
          </h2>
          <p className="mt-4 text-[17px] leading-[1.7] text-[#10213f]/70">
            Leading a team for the first time, pulling off a summit, finding your people. These are
            the AIESEC journeys that happen right here at home.
          </p>
        </div>

        <ol ref={roadRef} className="relative mt-14 md:mt-20">
          {/* the road: a dashed track, filled in yellow as you scroll */}
          <span
            className="absolute top-0 bottom-0 left-[28px] w-[3px] -translate-x-1/2 md:left-1/2"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, rgba(16,33,63,.18) 0 8px, transparent 8px 16px)',
            }}
            aria-hidden="true"
          />
          <motion.span
            className="absolute top-0 bottom-0 left-[28px] w-[3px] origin-top -translate-x-1/2 rounded-full bg-[#ffc845] shadow-[0_0_12px_rgba(255,200,69,.8)] md:left-1/2"
            style={{ scaleY: reduced ? 1 : progress }}
            aria-hidden="true"
          />
          {!reduced && (
            <motion.span
              className="absolute left-[28px] z-[5] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#ffc845] shadow-[0_0_0_6px_rgba(255,200,69,.3)] md:left-1/2"
              style={{ top: travellerTop }}
              aria-hidden="true"
            />
          )}

          {posts.map((post, i) => {
            const left = i % 2 === 0
            const quote = quotes[i]
            return (
              <li
                key={post.id}
                className="relative grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-5 pb-14 md:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] md:gap-x-6 md:pb-20"
              >
                <span className="col-start-1 row-start-1 flex justify-center self-start md:col-start-2 md:self-center">
                  <Station post={post} step={i + 1} />
                </span>

                <motion.div
                  className={`col-start-2 row-start-1 ${left ? 'md:col-start-1' : 'md:col-start-3'}`}
                  initial={reduced ? false : { opacity: 0, x: left ? -40 : 40, y: 20 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <StopCard post={post} quote={quote} />
                </motion.div>

                {/* desktop: the story's own words fill the other side of the road */}
                {quote && (
                  <motion.blockquote
                    className={`font-display row-start-1 hidden text-[28px] leading-[1.2] font-semibold text-balance md:block lg:text-[32px] ${
                      left ? 'md:col-start-3' : 'md:col-start-1 md:text-right'
                    }`}
                    style={{ color: categoryColor(post.category) }}
                    initial={reduced ? false : { opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                  >
                    <span className="block text-[64px] leading-[0.5] opacity-30" aria-hidden="true">
                      “
                    </span>
                    {quote}
                    <footer className="mt-3 font-sans text-[14px] font-medium text-[#10213f]/55">
                      {post.author_name}
                    </footer>
                  </motion.blockquote>
                )}
              </li>
            )
          })}
        </ol>

        {/* the next stop: outside the road, joined by a dashed stretch nobody has travelled yet */}
        <div className="relative grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-5 md:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] md:gap-x-6">
          <span
            className="absolute top-0 left-[28px] h-1/2 w-[3px] -translate-x-1/2 md:left-1/2"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, rgba(16,33,63,.18) 0 8px, transparent 8px 16px)',
            }}
            aria-hidden="true"
          />
          <span className="col-start-1 row-start-1 flex justify-center md:col-start-2">
            <span className="relative z-10 flex size-[56px] items-center justify-center rounded-full border-2 border-dashed border-[#10213f]/35 bg-white text-[#10213f] md:size-[70px]">
              <Plus size={24} />
            </span>
          </span>
          <div
            className={`col-start-2 row-start-1 ${posts.length % 2 === 0 ? 'md:col-start-1 md:text-right' : 'md:col-start-3'}`}
          >
            <p className="font-display text-[26px] leading-[1.1] font-bold text-[#10213f] md:text-[30px]">
              The next stop is yours.
            </p>
            <p className="mt-2 text-[15px] leading-[1.6] text-[#10213f]/65">
              Your first event, your first team, the moment AIESEC clicked. It all counts.
            </p>
            <Link
              to="/blog/submit"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#10213f] px-5 py-3 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10213f]"
            >
              <PenLine size={16} /> Write your story
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

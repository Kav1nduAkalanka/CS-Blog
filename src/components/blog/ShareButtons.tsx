import { useState } from 'react'
import { Check, Link2, Share2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { shareStory, storyUrl } from './storyUtils'

interface ShareButtonsProps {
  post: { id: string; title: string; excerpt: string }
  orientation?: 'row' | 'column'
  className?: string
}

const ICONS = {
  whatsapp:
    'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.43 9.44-9.43a9.38 9.38 0 0 1 9.43 9.44c0 5.2-4.24 9.43-9.44 9.43M20.08 3.9A11.3 11.3 0 0 0 12.05.58C5.8.58.7 5.67.7 11.93c0 2 .52 3.95 1.52 5.67L.6 23.5l6.02-1.58a11.3 11.3 0 0 0 5.42 1.38h.01c6.25 0 11.34-5.1 11.35-11.36 0-3.03-1.18-5.88-3.32-8.03',
  linkedin:
    'M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.86-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z',
  facebook:
    'M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.95.93-1.95 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z',
  x: 'M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-4.71-6.23-5.4 6.23H2.74l7.73-8.84L1.25 2.25h6.83l4.26 5.63 5.9-5.63Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z',
}

export function ShareButtons({ post, orientation = 'row', className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)
  const url = encodeURIComponent(storyUrl(post.id))
  const text = encodeURIComponent(post.title)

  const links = [
    { key: 'whatsapp', label: 'Share on WhatsApp', href: `https://wa.me/?text=${text}%20${url}` },
    {
      key: 'linkedin',
      label: 'Share on LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    },
    {
      key: 'facebook',
      label: 'Share on Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    },
    {
      key: 'x',
      label: 'Share on X',
      href: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    },
  ] as const

  const copy = async () => {
    await navigator.clipboard.writeText(storyUrl(post.id))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btn =
    'flex size-10 items-center justify-center rounded-full border border-[#d7e3f4] bg-white text-[#10213f]/70 transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

  return (
    <div
      className={cn('flex items-center gap-2.5', orientation === 'column' && 'flex-col', className)}
    >
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          type="button"
          onClick={() => shareStory(post)}
          className={cn(btn, 'bg-brand border-brand text-white hover:text-white')}
          aria-label="Share this story"
        >
          <Share2 size={16} />
        </button>
      )}
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
          aria-label={l.label}
        >
          <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
            <path d={ICONS[l.key]} />
          </svg>
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        className={btn}
        aria-label={copied ? 'Link copied' : 'Copy link'}
      >
        {copied ? <Check size={16} className="text-[#13a24a]" /> : <Link2 size={16} />}
      </button>
    </div>
  )
}

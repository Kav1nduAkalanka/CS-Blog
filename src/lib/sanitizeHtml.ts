import DOMPurify from 'dompurify'

/* Story HTML comes from public submissions, and the database only checks that
   new rows are 'pending', so anyone could insert raw HTML without using the
   form. Everything rendered with dangerouslySetInnerHTML goes through here:
   scripts, event handlers and javascript: links are removed, and the only
   iframes kept are YouTube embeds from the editor's video button. */

const YOUTUBE_EMBED = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//

let configured = false

function configure() {
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'iframe' || !(node instanceof Element)) return
    if (!YOUTUBE_EMBED.test(node.getAttribute('src') ?? '')) node.remove()
  })
  // links that open a new tab must not hand the story page to the new tab
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof Element && node.tagName === 'A' && node.getAttribute('target')) {
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
  configured = true
}

export function sanitizePostHtml(html: string): string {
  if (!configured) configure()
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'target'],
  })
}

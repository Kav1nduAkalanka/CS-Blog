import { useEditor, EditorContent } from '@tiptap/react'
import { useState, useRef } from 'react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Youtube from '@tiptap/extension-youtube'
import { supabase } from '../../lib/supabase'
import { enhanceBlogContentHtml } from '../../lib/blogContent'
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImageIcon,
  LinkIcon,
  Minus,
  Highlighter,
  Undo,
  Redo,
  Code,
  Loader2,
  Video,
} from 'lucide-react'

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      disabled={disabled}
      title={title}
      className={[
        'flex size-8 items-center justify-center rounded-lg text-[14px] transition-colors',
        active
          ? 'bg-brand text-white'
          : 'hover:bg-surface hover:text-navy text-[#6b7280] disabled:opacity-40',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="mx-1 h-6 w-px bg-[#e5e7eb]" />
}

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const imageFileRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: 'max-w-full h-auto' },
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        allowFullscreen: true,
        HTMLAttributes: {
          class: 'w-full aspect-video rounded-xl my-6 shadow-md mx-auto block max-w-[720px]',
        },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-brand underline' } }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Start writing your story…',
      }),
    ],
    content,
    onUpdate({ editor }) {
      const raw = editor.getHTML()
      const enhanced = enhanceBlogContentHtml(raw)
      onChange(enhanced)
      if (enhanced !== raw) {
        editor.commands.setContent(enhanced, { emitUpdate: false })
      }
    },
  })

  if (!editor) return null

  const addImageByUrl = () => {
    const url = window.prompt('Enter image URL:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const addImageByFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploadingImage(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error } = await supabase.storage
        .from('blog-images')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (!error && data) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('blog-images').getPublicUrl(data.path)
        editor.chain().focus().setImage({ src: publicUrl }).run()
      } else {
        // Fallback to local DataURL preview if Supabase storage is not reachable
        const reader = new FileReader()
        reader.onloadend = () => {
          if (reader.result) {
            editor.chain().focus().setImage({ src: reader.result as string }).run()
          }
        }
        reader.readAsDataURL(file)
      }
    } finally {
      setUploadingImage(false)
    }
  }

  const addYoutubeVideo = () => {
    const url = window.prompt(
      'Enter YouTube Video URL (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...):',
    )
    if (url && url.trim()) {
      editor.commands.setYoutubeVideo({
        src: url.trim(),
        width: 640,
        height: 360,
      })
    }
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Enter URL:', previousUrl ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#e5e7eb] bg-[#fafafa] px-3 py-2">
        {/* History */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo size={15} />
        </ToolbarButton>

        <Divider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={15} />
        </ToolbarButton>

        <Divider />

        {/* Inline formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline"
        >
          <UnderlineIcon size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive('highlight')}
          title="Highlight"
        >
          <Highlighter size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline code"
        >
          <Code size={15} />
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Highlighted caption box"
        >
          <Quote size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >
          <Minus size={15} />
        </ToolbarButton>

        <Divider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Align left"
        >
          <AlignLeft size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Align center"
        >
          <AlignCenter size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Align right"
        >
          <AlignRight size={15} />
        </ToolbarButton>

        <Divider />

        {/* Media */}
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Add link">
          <LinkIcon size={15} />
        </ToolbarButton>

        {/* Image — upload from device */}
        <input
          ref={imageFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) addImageByFile(file)
            e.target.value = ''
          }}
        />
        <ToolbarButton
          onClick={() => imageFileRef.current?.click()}
          title="Upload image from device"
          disabled={uploadingImage}
        >
          {uploadingImage ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ImageIcon size={15} />
          )}
        </ToolbarButton>

        {/* Image — paste URL */}
        <ToolbarButton onClick={addImageByUrl} title="Insert image by URL">
          <svg viewBox="0 0 15 15" className="size-[15px] fill-current" aria-hidden="true">
            <path d="M7.5 1a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 7.5 1ZM0 7.5a7.5 7.5 0 1 1 15 0 7.5 7.5 0 0 1-15 0Zm7.5-3a.5.5 0 0 1 .5.5v2h2a.5.5 0 0 1 0 1h-2v2a.5.5 0 0 1-1 0v-2h-2a.5.5 0 0 1 0-1h2v-2a.5.5 0 0 1 .5-.5Z" />
          </svg>
        </ToolbarButton>

        {/* Video — YouTube embed */}
        <ToolbarButton onClick={addYoutubeVideo} title="Embed YouTube Video">
          <Video size={15} />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="prose prose-slate [&_.ProseMirror_blockquote]:border-brand max-w-none px-6 py-5 [&_.ProseMirror]:min-h-[320px] [&_.ProseMirror]:outline-none [&_.ProseMirror_.blog-pull-quote]:mb-6 [&_.ProseMirror_.blog-pull-quote]:text-[20px] [&_.ProseMirror_.blog-pull-quote]:leading-[1.6] [&_.ProseMirror_.blog-pull-quote]:font-medium [&_.ProseMirror_.blog-pull-quote]:text-[#005bb2] [&_.ProseMirror_.blog-pull-quote]:italic [&_.ProseMirror_blockquote]:my-6 [&_.ProseMirror_blockquote]:rounded-r-xl [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:bg-[#ebf5ff] [&_.ProseMirror_blockquote]:px-8 [&_.ProseMirror_blockquote]:py-5 [&_.ProseMirror_blockquote]:text-[#45455b] [&_.ProseMirror_blockquote]:not-italic [&_.ProseMirror_img]:mx-auto [&_.ProseMirror_img]:my-6 [&_.ProseMirror_img]:block [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:w-auto [&_.ProseMirror_img]:max-w-[600px] [&_.ProseMirror_img]:rounded-xl [&_.ProseMirror_iframe]:mx-auto [&_.ProseMirror_iframe]:my-6 [&_.ProseMirror_iframe]:block [&_.ProseMirror_iframe]:w-full [&_.ProseMirror_iframe]:max-w-[680px] [&_.ProseMirror_iframe]:aspect-video [&_.ProseMirror_iframe]:rounded-xl [&_.ProseMirror_iframe]:shadow-md [&_.ProseMirror_p]:mb-4 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[#9ca3af] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
      />
    </div>
  )
}

import { useRef, useState } from 'react'
import { Upload, Link2, X, Loader2, ImageIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface ImageUploaderProps {
  value: string
  onChange: (url: string) => void
  label?: string
}

async function uploadToSupabase(file: File): Promise<string> {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  if (!url || url === 'https://your-project-id.supabase.co') {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(file)
    })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabase.storage
    .from('blog-images')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw new Error(error.message)

  const {
    data: { publicUrl },
  } = supabase.storage.from('blog-images').getPublicUrl(data.path)

  return publicUrl
}

export function ImageUploader({ value, onChange, label = 'Image' }: ImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [urlInput, setUrlInput] = useState(value)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP, etc.)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10 MB.')
      return
    }

    setError('')
    setUploading(true)
    try {
      const url = await uploadToSupabase(file)
      onChange(url)
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes('bucket')
          ? 'Storage bucket "blog-images" not found. See SUPABASE_SETUP.md Step 6.'
          : 'Upload failed. Please check your Supabase storage settings.',
      )
    }
    setUploading(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleUrlCommit = () => {
    onChange(urlInput)
  }

  return (
    <div>
      <label className="text-navy mb-2 block text-[13px] font-semibold">{label}</label>

      {/* Tab toggle */}
      <div className="mb-3 flex rounded-lg border border-[#e5e7eb] bg-[#f5f7fa] p-1">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={[
            'flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-[13px] font-medium transition-colors',
            mode === 'upload' ? 'text-navy bg-white shadow-sm' : 'hover:text-navy text-[#9ca3af]',
          ].join(' ')}
        >
          <Upload size={13} />
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={[
            'flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-[13px] font-medium transition-colors',
            mode === 'url' ? 'text-navy bg-white shadow-sm' : 'hover:text-navy text-[#9ca3af]',
          ].join(' ')}
        >
          <Link2 size={13} />
          Paste URL
        </button>
      </div>

      {/* Upload mode */}
      {mode === 'upload' && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileRef.current?.click()}
          className={[
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 transition-colors',
            dragging
              ? 'border-brand bg-brand/5'
              : 'hover:border-brand/60 hover:bg-brand/5 border-[#e5e7eb] bg-[#fafafa]',
            uploading ? 'cursor-wait' : '',
          ].join(' ')}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
          {uploading ? (
            <>
              <Loader2 size={28} className="text-brand animate-spin" />
              <p className="text-[13px] text-[#6b7280]">Uploading…</p>
            </>
          ) : (
            <>
              <div className="bg-brand/10 flex size-12 items-center justify-center rounded-full">
                <ImageIcon size={22} className="text-brand" />
              </div>
              <div className="text-center">
                <p className="text-navy text-[14px] font-semibold">
                  Drop image here or <span className="text-brand">browse</span>
                </p>
                <p className="mt-1 text-[12px] text-[#9ca3af]">JPG, PNG, WebP, GIF · Max 10 MB</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* URL mode */}
      {mode === 'url' && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={handleUrlCommit}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlCommit()}
            placeholder="https://example.com/image.jpg"
            className="text-navy focus:border-brand focus:ring-brand/20 h-[44px] flex-1 rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 text-[14px] placeholder:text-[#9ca3af] focus:ring-2 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleUrlCommit}
            className="bg-brand hover:bg-brand-dark h-[44px] rounded-xl px-4 text-[14px] font-semibold text-white transition-colors"
          >
            Use
          </button>
        </div>
      )}

      {/* Error */}
      {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}

      {/* Preview */}
      {value && (
        <div className="relative mt-3 overflow-hidden rounded-xl border border-[#e5e7eb]">
          <img
            src={value}
            alt="Preview"
            className="aspect-video w-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <button
            type="button"
            onClick={() => {
              onChange('')
              setUrlInput('')
            }}
            className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            aria-label="Remove image"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

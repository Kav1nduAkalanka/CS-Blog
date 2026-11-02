export type BlogPostStatus = 'draft' | 'pending' | 'published' | 'rejected'

export type BlogPostCategory =
  | 'Exchange Experiences'
  | 'Leadership'
  | 'Personal Development'
  | 'Events & Announcements'
  | 'Member Stories'
  | 'Global Impact'

export interface BlogPost {
  id: string
  title: string
  excerpt: string
  content: string // rich HTML from TipTap
  category: BlogPostCategory
  cover_image_url: string | null
  author_name: string
  author_email?: string | null
  author_avatar_url: string | null
  read_time: number // minutes
  status: BlogPostStatus
  published_at: string | null // ISO timestamp
  created_at: string
  updated_at: string
  created_by: string | null
}

export type BlogPostInsert = Omit<BlogPost, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}
export type BlogPostUpdate = Partial<BlogPost>

export type ContactMessageStatus = 'new' | 'read' | 'replied' | 'archived'

export interface ContactMessage {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: ContactMessageStatus
  created_at: string
  replied_at: string | null
}

export type ContactMessageInsert = Pick<ContactMessage, 'name' | 'email' | 'subject' | 'message'>
export type ContactMessageUpdate = Partial<Pick<ContactMessage, 'status' | 'replied_at'>>

// Supabase Database type for the client
export interface Database {
  public: {
    Tables: {
      blog_posts: {
        Row: BlogPost
        Insert: BlogPostInsert
        Update: BlogPostUpdate
        Relationships: []
      }
      contact_messages: {
        Row: ContactMessage
        Insert: ContactMessageInsert
        Update: ContactMessageUpdate
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

# Supabase Setup Guide

Follow these steps once to connect the blog admin panel to a real database.

---

## 1. Create a Supabase Project

1. Go to **https://supabase.com** and sign up (use your personal Gmail for now).
2. Click **"New project"** → give it a name like `aiesec-cs-blog`.
3. Choose a region closest to Sri Lanka (e.g. **Singapore**).
4. Wait ~2 minutes for the project to provision.

---

## 2. Create the Blog Posts Table

In your Supabase project, go to **SQL Editor** and run this SQL:

```sql
-- Create the blog_posts table
CREATE TABLE blog_posts (
  id            uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  title         text            NOT NULL,
  excerpt       text            NOT NULL DEFAULT '',
  content       text            NOT NULL DEFAULT '',
  category      text            NOT NULL,
  cover_image_url text,
  author_name   text            NOT NULL,
  author_email  text,
  author_avatar_url text,
  read_time     integer         NOT NULL DEFAULT 5,
  status        text            NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
  published_at  timestamptz,
  created_at    timestamptz     NOT NULL DEFAULT now(),
  updated_at    timestamptz     NOT NULL DEFAULT now(),
  created_by    uuid            REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts (public blog)
CREATE POLICY "Public can read published posts"
  ON blog_posts FOR SELECT
  USING (status = 'published');

-- Anyone/students can submit stories in pending state
CREATE POLICY "Public can submit pending posts"
  ON blog_posts FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

-- Authenticated users (editors) can do everything
CREATE POLICY "Editors can manage all posts"
  ON blog_posts FOR ALL
  USING (auth.role() = 'authenticated');
```

**Already created the table?** Run this migration:

```sql
-- Add author_email column if not present
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS author_email text;

-- Update status check constraint to include 'pending' and 'rejected'
ALTER TABLE blog_posts DROP CONSTRAINT IF EXISTS blog_posts_status_check;
ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_status_check
  CHECK (status IN ('draft', 'pending', 'published', 'rejected'));

-- Allow public student submissions
DROP POLICY IF EXISTS "Public can submit pending posts" ON blog_posts;
CREATE POLICY "Public can submit pending posts"
  ON blog_posts FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');
```

---

## 3. Add Your Environment Variables

Open the file `.env.local` in the project root and replace the placeholder values:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

To find these values:

- In Supabase, go to **Project Settings → API**
- Copy **Project URL** → paste as `VITE_SUPABASE_URL`
- Copy **anon / public** key → paste as `VITE_SUPABASE_ANON_KEY`

---

## 4. Create Editor Accounts

Editors log in with their email + password. To create an account:

1. In Supabase, go to **Authentication → Users**
2. Click **"Add user"** → **"Create new user"**
3. Enter the editor's email and a secure password
4. Click **"Create user"**

Repeat for each editor. They can then log in at `/admin` on your website.

> **To change a password later:** Authentication → Users → find the user → "Send password reset email" or manually update.

---

## 5. Transfer the Project (When Handing Over)

When you leave the IM team:

1. In Supabase, go to **Project Settings → General**
2. Scroll to **"Transfer Project"**
3. Enter the new person's email
4. They accept via email → they become the new owner

No data is lost during transfer.

---

## 6. Set Up a Storage Bucket for Image Uploads ⚠️ Required

The admin panel now supports direct image uploads. Run this in **SQL Editor** to enable it:

```sql
-- Create a public bucket for blog images
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view uploaded images (public blog)
CREATE POLICY "Anyone can view blog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

-- Logged-in editors can upload images
CREATE POLICY "Editors can upload blog images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'blog-images' AND auth.role() = 'authenticated');

-- Anyone (including student story submissions) can upload images to blog-images
CREATE POLICY "Anyone can upload submission images"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'blog-images');

-- Logged-in editors can delete their uploaded images
CREATE POLICY "Editors can delete blog images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'blog-images' AND auth.role() = 'authenticated');
```

After running this SQL, editors can:

- **Upload images from their computer** directly in the Cover Image field and the rich text editor
- **Paste a URL** if they prefer to link an external image
- Images are stored permanently in Supabase Storage and served via a public CDN URL

---

## Summary of URLs

| URL                     | What it does                       |
| ----------------------- | ---------------------------------- |
| `/blog`                 | Public blog listing page           |
| `/blog/:id`             | Individual blog article            |
| `/blog/submit`          | Student story submission page      |
| `/admin`                | Editor login page                  |
| `/admin/dashboard`      | Manage all posts & approve pending |
| `/admin/posts/new`      | Write a new post                   |
| `/admin/posts/:id/edit` | Edit an existing post              |
| `/admin/messages`       | Contact message inbox              |
| `/admin/messages/:id`   | View a contact message             |

---

## 7. Set Up Contact Messages Inbox

Run this in **SQL Editor** to store contact form submissions and let admins manage them:

```sql
-- Contact messages from the public contact form
CREATE TABLE contact_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  email       text        NOT NULL,
  subject     text        NOT NULL,
  message     text        NOT NULL,
  status      text        NOT NULL DEFAULT 'new',  -- new | read | replied | archived
  created_at  timestamptz NOT NULL DEFAULT now(),
  replied_at  timestamptz
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Public can submit messages (contact form)
CREATE POLICY "Anyone can submit contact messages"
  ON contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only logged-in admins can read/update
CREATE POLICY "Admins can read contact messages"
  ON contact_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update contact messages"
  ON contact_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete contact messages"
  ON contact_messages FOR DELETE
  TO authenticated
  USING (true);

-- Optional: limit spam — max 3 submissions per email per hour
CREATE OR REPLACE FUNCTION check_contact_message_rate_limit()
RETURNS trigger AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM contact_messages
    WHERE email = NEW.email
      AND created_at > now() - interval '1 hour'
  ) >= 3 THEN
    RAISE EXCEPTION 'Too many messages from this email. Please try again later.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_message_rate_limit
  BEFORE INSERT ON contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION check_contact_message_rate_limit();
```

**Already created the table?** Run this to fix policies if messages save but the admin inbox stays empty:

```sql
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Admins can read contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Admins can update contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Admins can delete contact messages" ON contact_messages;

CREATE POLICY "Anyone can submit contact messages"
  ON contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read contact messages"
  ON contact_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update contact messages"
  ON contact_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete contact messages"
  ON contact_messages FOR DELETE
  TO authenticated
  USING (true);
```

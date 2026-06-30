
-- Attachments column on threads
ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Storage RLS: users manage only their own folder (first path segment = user_id)
CREATE POLICY "thread-uploads: users read own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'thread-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "thread-uploads: users insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'thread-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "thread-uploads: users update own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'thread-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "thread-uploads: users delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'thread-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- Migração 004 — Galeria de fotos e vídeos
-- Execute no Supabase: SQL Editor → New Query
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- MEDIA_POSTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id     UUID REFERENCES matches(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  media_type   TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption      TEXT,
  author_name  TEXT,  -- cached display name
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS media_posts_group_id_idx ON media_posts(group_id);
CREATE INDEX IF NOT EXISTS media_posts_created_at_idx ON media_posts(created_at DESC);

ALTER TABLE media_posts ENABLE ROW LEVEL SECURITY;

-- Membros do grupo podem ver os posts do grupo
DROP POLICY IF EXISTS "media_posts: group select" ON media_posts;
CREATE POLICY "media_posts: group select" ON media_posts
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

-- Membros do grupo podem postar
DROP POLICY IF EXISTS "media_posts: group insert" ON media_posts;
CREATE POLICY "media_posts: group insert" ON media_posts
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

-- Apenas o autor pode deletar
DROP POLICY IF EXISTS "media_posts: author delete" ON media_posts;
CREATE POLICY "media_posts: author delete" ON media_posts
  FOR DELETE USING (auth.uid() = author_id);

-- ────────────────────────────────────────────────────────────
-- Supabase Storage bucket "pelada-media" (criar manualmente)
-- ────────────────────────────────────────────────────────────
-- No Supabase Dashboard: Storage → New bucket
-- Nome: pelada-media
-- Public: true (para servir imagens/vídeos sem auth)
--
-- Adicionar Storage Policy (RLS de storage):
-- Bucket: pelada-media
-- INSERT: auth.uid() IS NOT NULL
-- SELECT: true (público)
-- DELETE: auth.uid()::text = (storage.foldername(name))[1]

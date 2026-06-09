-- ============================================================
-- Futebom — Fix Permissions & Storage
-- Execute este arquivo no Supabase: SQL Editor → New Query → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- GROUPS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  emoji                TEXT NOT NULL DEFAULT '⚽',
  description          TEXT,
  invite_code          TEXT NOT NULL UNIQUE DEFAULT upper(substring(gen_random_uuid()::text from 1 for 8)),
  is_password_protected BOOLEAN NOT NULL DEFAULT false,
  password_hash        TEXT,
  member_count         INT NOT NULL DEFAULT 0,
  created_by           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS groups_created_by_idx ON groups(created_by);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ver grupos
DROP POLICY IF EXISTS "groups: read all" ON groups;
CREATE POLICY "groups: read all" ON groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Apenas app_admins podem criar grupos
DROP POLICY IF EXISTS "groups: admin insert" ON groups;
CREATE POLICY "groups: admin insert" ON groups
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- Apenas app_admins podem editar grupos
DROP POLICY IF EXISTS "groups: admin update" ON groups;
CREATE POLICY "groups: admin update" ON groups
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- Apenas app_admins podem excluir grupos
DROP POLICY IF EXISTS "groups: admin delete" ON groups;
CREATE POLICY "groups: admin delete" ON groups
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- GROUP_MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_members_user_id_idx ON group_members(user_id);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ver membros
DROP POLICY IF EXISTS "group_members: read all" ON group_members;
CREATE POLICY "group_members: read all" ON group_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Usuário pode entrar em um grupo (inserir a si mesmo)
DROP POLICY IF EXISTS "group_members: self insert" ON group_members;
CREATE POLICY "group_members: self insert" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuário pode sair de um grupo (excluir a si mesmo)
DROP POLICY IF EXISTS "group_members: self delete" ON group_members;
CREATE POLICY "group_members: self delete" ON group_members
  FOR DELETE USING (auth.uid() = user_id);

-- App admins podem remover qualquer membro
DROP POLICY IF EXISTS "group_members: admin delete" ON group_members;
CREATE POLICY "group_members: admin delete" ON group_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- APP_ADMINS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode verificar se é admin (necessário para o checkIsAdmin)
DROP POLICY IF EXISTS "app_admins: read all" ON app_admins;
CREATE POLICY "app_admins: read all" ON app_admins
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Apenas um admin pode adicionar outros admins (ou o primeiro admin insere a si mesmo)
-- Para o super admin inicial: permitir que um usuário se insira se seu email está na lista
-- ATENÇÃO: esta policy é permissiva para autoRegisterSuperAdmin funcionar
DROP POLICY IF EXISTS "app_admins: self insert" ON app_admins;
CREATE POLICY "app_admins: self insert" ON app_admins
  FOR INSERT WITH CHECK (
    -- Permite inserir a si mesmo (para autoRegisterSuperAdmin)
    auth.uid() = user_id
    OR
    -- Permite que um admin existente insira outros
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- Apenas admins podem remover admins
DROP POLICY IF EXISTS "app_admins: admin delete" ON app_admins;
CREATE POLICY "app_admins: admin delete" ON app_admins
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- MEDIA_POSTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name  TEXT,
  match_id     UUID REFERENCES matches(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  media_type   TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS media_posts_group_id_idx ON media_posts(group_id);
CREATE INDEX IF NOT EXISTS media_posts_author_id_idx ON media_posts(author_id);

ALTER TABLE media_posts ENABLE ROW LEVEL SECURITY;

-- Membros do grupo podem ver posts do seu grupo
DROP POLICY IF EXISTS "media_posts: members read" ON media_posts;
CREATE POLICY "media_posts: members read" ON media_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = media_posts.group_id
        AND user_id = auth.uid()
    )
  );

-- Membros do grupo podem postar
DROP POLICY IF EXISTS "media_posts: members insert" ON media_posts;
CREATE POLICY "media_posts: members insert" ON media_posts
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = media_posts.group_id
        AND user_id = auth.uid()
    )
  );

-- Apenas o autor pode excluir seu post (ou app admins)
DROP POLICY IF EXISTS "media_posts: author delete" ON media_posts;
CREATE POLICY "media_posts: author delete" ON media_posts
  FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- TRIGGER: Atualizar member_count automaticamente
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS group_member_count_trigger ON group_members;
CREATE TRIGGER group_member_count_trigger
  AFTER INSERT OR DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

-- ────────────────────────────────────────────────────────────
-- STORAGE: Bucket pelada-media
-- (Execute separadamente no Storage ou via SQL abaixo)
-- ────────────────────────────────────────────────────────────

-- Criar o bucket (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pelada-media',
  'pelada-media',
  true,  -- público para leitura via URL
  52428800,  -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];

-- Policy: Qualquer um pode VER as mídias (bucket público)
DROP POLICY IF EXISTS "pelada-media: public read" ON storage.objects;
CREATE POLICY "pelada-media: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'pelada-media');

-- Policy: Usuário autenticado pode fazer UPLOAD na sua própria pasta
DROP POLICY IF EXISTS "pelada-media: auth upload" ON storage.objects;
CREATE POLICY "pelada-media: auth upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pelada-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Usuário pode excluir seus próprios arquivos
DROP POLICY IF EXISTS "pelada-media: owner delete" ON storage.objects;
CREATE POLICY "pelada-media: owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'pelada-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ────────────────────────────────────────────────────────────
-- REALTIME: Habilitar nas tabelas necessárias
-- ────────────────────────────────────────────────────────────
-- Rode no Supabase → Database → Replication → Tables
-- Habilite: groups, group_members, media_posts

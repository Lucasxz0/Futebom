-- ============================================================
-- Futebom — Registrar Admin Único + Corrigir Policies
-- Execute no Supabase: SQL Editor → New Query → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Garantir que a tabela app_admins existe
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 2. Inserir o admin (melo97775@gmail.com)
-- ────────────────────────────────────────────────────────────
INSERT INTO app_admins (user_id, granted_by)
VALUES (
  'c73ee724-1ffe-45bf-93c8-5162387ba5ab',
  'c73ee724-1ffe-45bf-93c8-5162387ba5ab'
)
ON CONFLICT (user_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. RLS da tabela app_admins
--    - Qualquer autenticado pode LER (necessário para checkIsAdmin)
--    - NINGUÉM pode se inserir como admin via app (removida policy "self insert")
--    - Apenas admins existentes podem gerenciar outros admins
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "app_admins: read all" ON app_admins;
CREATE POLICY "app_admins: read all" ON app_admins
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- REMOVER a policy que deixava qualquer um se inserir como admin
DROP POLICY IF EXISTS "app_admins: self insert" ON app_admins;

-- Apenas admins existentes podem adicionar outros admins
DROP POLICY IF EXISTS "app_admins: admin insert" ON app_admins;
CREATE POLICY "app_admins: admin insert" ON app_admins
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- Apenas admins podem remover admins
DROP POLICY IF EXISTS "app_admins: admin delete" ON app_admins;
CREATE POLICY "app_admins: admin delete" ON app_admins
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- 4. Garantir que a tabela groups existe com RLS correta
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  emoji                 TEXT NOT NULL DEFAULT '⚽',
  description           TEXT,
  invite_code           TEXT NOT NULL UNIQUE DEFAULT upper(substring(gen_random_uuid()::text from 1 for 8)),
  is_password_protected BOOLEAN NOT NULL DEFAULT false,
  password_hash         TEXT,
  member_count          INT NOT NULL DEFAULT 0,
  created_by            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode VER grupos (para poder entrar)
DROP POLICY IF EXISTS "groups: read all" ON groups;
CREATE POLICY "groups: read all" ON groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Apenas app_admins podem CRIAR grupos
DROP POLICY IF EXISTS "groups: admin insert" ON groups;
CREATE POLICY "groups: admin insert" ON groups
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- Apenas app_admins podem EDITAR grupos
DROP POLICY IF EXISTS "groups: admin update" ON groups;
CREATE POLICY "groups: admin update" ON groups
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- Apenas app_admins podem EXCLUIR grupos
DROP POLICY IF EXISTS "groups: admin delete" ON groups;
CREATE POLICY "groups: admin delete" ON groups
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- 5. Garantir que a tabela group_members existe com RLS correta
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ver membros
DROP POLICY IF EXISTS "group_members: read all" ON group_members;
CREATE POLICY "group_members: read all" ON group_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Usuário pode entrar em um grupo (inserir a si mesmo)
DROP POLICY IF EXISTS "group_members: self insert" ON group_members;
CREATE POLICY "group_members: self insert" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuário pode sair (excluir a si mesmo) OU admin pode remover qualquer um
DROP POLICY IF EXISTS "group_members: self delete" ON group_members;
CREATE POLICY "group_members: self delete" ON group_members
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- 6. Verificar resultado
-- ────────────────────────────────────────────────────────────
-- Rode isto para confirmar que o admin foi inserido:
SELECT user_id, added_at FROM app_admins;

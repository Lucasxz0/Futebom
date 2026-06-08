-- ============================================================
-- Migração 002 — Grupos (sincronização compartilhada)
-- Execute no Supabase: SQL Editor → New Query
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT 'Minha Pelada',
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 8)),
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Habilitar RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- POLICIES FOR GROUPS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "groups: read by members" ON groups;
CREATE POLICY "groups: read by members" ON groups
  FOR SELECT USING (
    id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "groups: creator insert" ON groups;
CREATE POLICY "groups: creator insert" ON groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "groups: creator update" ON groups;
CREATE POLICY "groups: creator update" ON groups
  FOR UPDATE USING (auth.uid() = created_by);

-- Anyone can read groups by invite_code (for joining)
DROP POLICY IF EXISTS "groups: read by invite_code" ON groups;
CREATE POLICY "groups: read by invite_code" ON groups
  FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────
-- POLICIES FOR GROUP_MEMBERS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "group_members: read own" ON group_members;
CREATE POLICY "group_members: read own" ON group_members
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "group_members: insert self" ON group_members;
CREATE POLICY "group_members: insert self" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "group_members: delete self" ON group_members;
CREATE POLICY "group_members: delete self" ON group_members
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- Adicionar group_id nas tabelas existentes
-- ────────────────────────────────────────────────────────────
ALTER TABLE players ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

-- Índices
CREATE INDEX IF NOT EXISTS players_group_id_idx ON players(group_id);
CREATE INDEX IF NOT EXISTS matches_group_id_idx ON matches(group_id);

-- ────────────────────────────────────────────────────────────
-- Atualizar RLS de players para aceitar membros do grupo
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "players: owner select" ON players;
CREATE POLICY "players: group select" ON players
  FOR SELECT USING (
    -- legado: user_id direto ou via grupo
    auth.uid() = user_id
    OR group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "players: owner insert" ON players;
CREATE POLICY "players: group insert" ON players
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      group_id IS NULL
      OR group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "players: owner update" ON players;
CREATE POLICY "players: group update" ON players
  FOR UPDATE USING (
    auth.uid() = user_id
    OR group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "players: owner delete" ON players;
CREATE POLICY "players: group delete" ON players
  FOR DELETE USING (
    auth.uid() = user_id
    OR group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- Atualizar RLS de matches para aceitar membros do grupo
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "matches: read by code" ON matches;
CREATE POLICY "matches: group select" ON matches
  FOR SELECT USING (
    true -- qualquer autenticado pode ler via código de acesso ou grupo
  );

DROP POLICY IF EXISTS "matches: creator insert" ON matches;
CREATE POLICY "matches: group insert" ON matches
  FOR INSERT WITH CHECK (
    auth.uid() = creator_id
    AND (
      group_id IS NULL
      OR group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "matches: creator update" ON matches;
CREATE POLICY "matches: group update" ON matches
  FOR UPDATE USING (
    auth.uid() = creator_id
    OR group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "matches: creator delete" ON matches;
CREATE POLICY "matches: group delete" ON matches
  FOR DELETE USING (
    auth.uid() = creator_id
    OR group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- REALTIME: habilitar nas novas tabelas
-- ────────────────────────────────────────────────────────────
-- Rode no Supabase → Database → Replication → Tables
-- Habilite: groups, group_members

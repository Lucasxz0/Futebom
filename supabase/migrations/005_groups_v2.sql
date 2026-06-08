-- ============================================================
-- Migração 005 — Grupos V2 (admins, senha, multi-grupo)
-- Execute no Supabase: SQL Editor → New Query
-- ============================================================

-- ── Atualizar tabela groups ──────────────────────────────────────────
ALTER TABLE groups ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_password_protected BOOLEAN DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '⚽';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS member_count INT DEFAULT 0;

-- ── Tabela de admins do app (super-admins que podem criar grupos) ────
CREATE TABLE IF NOT EXISTS app_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_admins: read authenticated" ON app_admins;
CREATE POLICY "app_admins: read authenticated" ON app_admins
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "app_admins: insert by admin" ON app_admins;
CREATE POLICY "app_admins: insert by admin" ON app_admins
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'email' = 'melo97775@gmail.com')
    OR auth.uid() IN (SELECT user_id FROM app_admins)
  );

DROP POLICY IF EXISTS "app_admins: delete by admin" ON app_admins;
CREATE POLICY "app_admins: delete by admin" ON app_admins
  FOR DELETE USING (
    auth.uid() IN (SELECT user_id FROM app_admins)
  );

-- ── Atualizar política de INSERT de grupos: só admins criam ──────────
DROP POLICY IF EXISTS "groups: creator insert" ON groups;
DROP POLICY IF EXISTS "groups: admin insert" ON groups;
CREATE POLICY "groups: admin insert" ON groups
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM app_admins)
  );

-- ── Política de UPDATE: admins do app podem editar qualquer grupo ────
DROP POLICY IF EXISTS "groups: creator update" ON groups;
DROP POLICY IF EXISTS "groups: admin update" ON groups;
CREATE POLICY "groups: admin update" ON groups
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM app_admins)
    OR auth.uid() = created_by
  );

-- ── Política de DELETE: só admins do app podem excluir grupos ────────
DROP POLICY IF EXISTS "groups: admin delete" ON groups;
CREATE POLICY "groups: admin delete" ON groups
  FOR DELETE USING (
    auth.uid() IN (SELECT user_id FROM app_admins)
  );

-- ── Qualquer autenticado pode VER os grupos disponíveis ──────────────
-- (a política "groups: read by invite_code" já cobre isso via true)
-- Garantir que exista:
DROP POLICY IF EXISTS "groups: read all authenticated" ON groups;
CREATE POLICY "groups: read all authenticated" ON groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── Contador de membros (trigger automático) ─────────────────────────
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE groups SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_group_member_count ON group_members;
CREATE TRIGGER trg_group_member_count
AFTER INSERT OR DELETE ON group_members
FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

-- ── Permitir admins do app gerenciar membros de qualquer grupo ───────
DROP POLICY IF EXISTS "group_members: admin delete" ON group_members;
CREATE POLICY "group_members: admin delete" ON group_members
  FOR DELETE USING (
    auth.uid() IN (SELECT user_id FROM app_admins)
    OR auth.uid() = user_id
  );

-- ── Atualizar contador inicial para grupos existentes ────────────────
UPDATE groups g
SET member_count = (
  SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id
);

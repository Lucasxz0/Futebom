-- ============================================================
-- Futebom — Permitir que qualquer usuário crie grupos
-- Execute no Supabase: SQL Editor → New Query → Run
-- ============================================================

-- 1. Permitir INSERT para qualquer usuário logado
DROP POLICY IF EXISTS "groups: admin insert" ON groups;
DROP POLICY IF EXISTS "groups: authenticated insert" ON groups;
CREATE POLICY "groups: authenticated insert" ON groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Permitir UPDATE para o criador do grupo (ou admins gerais)
DROP POLICY IF EXISTS "groups: admin update" ON groups;
DROP POLICY IF EXISTS "groups: admin and creator update" ON groups;
CREATE POLICY "groups: admin and creator update" ON groups
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid()::text = 'c73ee724-1ffe-45bf-93c8-5162387ba5ab'
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- 3. Permitir DELETE para o criador do grupo (ou admins gerais)
DROP POLICY IF EXISTS "groups: admin delete" ON groups;
DROP POLICY IF EXISTS "groups: admin and creator delete" ON groups;
CREATE POLICY "groups: admin and creator delete" ON groups
  FOR DELETE USING (
    auth.uid() = created_by
    OR auth.uid()::text = 'c73ee724-1ffe-45bf-93c8-5162387ba5ab'
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

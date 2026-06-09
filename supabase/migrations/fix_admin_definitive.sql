-- ============================================================
-- Futebom — FIX DEFINITIVO: Admin + Permissões de Grupo
-- Execute no Supabase: SQL Editor → New Query → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PASSO 1: Criar tabela app_admins (se não existir)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- PASSO 2: Desabilitar RLS temporariamente para inserir o admin
-- ────────────────────────────────────────────────────────────
ALTER TABLE app_admins DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- PASSO 3: Inserir o admin (melo97775@gmail.com)
-- ────────────────────────────────────────────────────────────
DELETE FROM app_admins WHERE user_id = 'c73ee724-1ffe-45bf-93c8-5162387ba5ab';
INSERT INTO app_admins (user_id, granted_by)
VALUES (
  'c73ee724-1ffe-45bf-93c8-5162387ba5ab',
  'c73ee724-1ffe-45bf-93c8-5162387ba5ab'
);

-- ────────────────────────────────────────────────────────────
-- PASSO 4: Reabilitar RLS com policies corretas
-- ────────────────────────────────────────────────────────────
ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

-- Remover todas as policies antigas
DROP POLICY IF EXISTS "app_admins: read all" ON app_admins;
DROP POLICY IF EXISTS "app_admins: self insert" ON app_admins;
DROP POLICY IF EXISTS "app_admins: admin insert" ON app_admins;
DROP POLICY IF EXISTS "app_admins: admin delete" ON app_admins;

-- Qualquer autenticado pode LER (necessário para checkIsAdmin funcionar)
CREATE POLICY "app_admins: read all" ON app_admins
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Apenas admins existentes podem ADICIONAR novos admins
CREATE POLICY "app_admins: admin insert" ON app_admins
  FOR INSERT WITH CHECK (
    auth.uid()::text = 'c73ee724-1ffe-45bf-93c8-5162387ba5ab'
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- Apenas admins podem REMOVER outros admins
CREATE POLICY "app_admins: admin delete" ON app_admins
  FOR DELETE USING (
    auth.uid()::text = 'c73ee724-1ffe-45bf-93c8-5162387ba5ab'
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- PASSO 5: Corrigir policies da tabela groups
-- ────────────────────────────────────────────────────────────
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups: read all" ON groups;
DROP POLICY IF EXISTS "groups: admin insert" ON groups;
DROP POLICY IF EXISTS "groups: admin update" ON groups;
DROP POLICY IF EXISTS "groups: admin delete" ON groups;
DROP POLICY IF EXISTS "groups: creator insert" ON groups;
DROP POLICY IF EXISTS "groups: creator update" ON groups;
DROP POLICY IF EXISTS "groups: creator delete" ON groups;

-- Qualquer autenticado pode VER grupos
CREATE POLICY "groups: read all" ON groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Apenas o admin hardcoded OU um admin do banco pode CRIAR
CREATE POLICY "groups: admin insert" ON groups
  FOR INSERT WITH CHECK (
    auth.uid()::text = 'c73ee724-1ffe-45bf-93c8-5162387ba5ab'
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- Apenas o admin hardcoded OU um admin do banco pode EDITAR
CREATE POLICY "groups: admin update" ON groups
  FOR UPDATE USING (
    auth.uid()::text = 'c73ee724-1ffe-45bf-93c8-5162387ba5ab'
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- Apenas o admin hardcoded OU um admin do banco pode EXCLUIR
CREATE POLICY "groups: admin delete" ON groups
  FOR DELETE USING (
    auth.uid()::text = 'c73ee724-1ffe-45bf-93c8-5162387ba5ab'
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- PASSO 6: Verificar que deu certo (vai mostrar o admin)
-- ────────────────────────────────────────────────────────────
SELECT 
  a.user_id,
  a.added_at,
  u.email
FROM app_admins a
LEFT JOIN auth.users u ON u.id = a.user_id;

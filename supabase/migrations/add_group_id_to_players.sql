-- ============================================================
-- Futebom — Adicionar group_id na tabela players
-- Execute no Supabase: SQL Editor → New Query → Run
-- É seguro rodar mesmo se já rodou antes (IF NOT EXISTS / IF NOT EXISTS)
-- ============================================================

-- 1. Adicionar coluna group_id (nullable — jogadores existentes ficam sem grupo)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- 2. Índice para buscas por grupo
CREATE INDEX IF NOT EXISTS players_group_id_idx ON players(group_id);

-- 3. Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'players'
ORDER BY ordinal_position;

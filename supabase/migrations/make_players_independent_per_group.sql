-- ============================================================
-- Futebom — Tornar jogadores independentes por grupo
-- Execute no Supabase: SQL Editor → New Query → Run
-- ============================================================

-- 1. Remover o índice antigo que impedia o mesmo usuário de ter 
-- jogadores com o mesmo nome em grupos diferentes
DROP INDEX IF EXISTS players_user_name_unique CASCADE;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_user_name_unique CASCADE;

-- 2. Criar novo índice que garante que o nome do jogador seja único
-- apenas dentro do mesmo grupo (ou na lista pessoal, caso group_id seja nulo).
-- Usamos COALESCE para garantir que valores nulos sejam tratados como um "grupo sem nome".
CREATE UNIQUE INDEX IF NOT EXISTS players_user_group_name_unique 
  ON players (user_id, lower(name), COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid));

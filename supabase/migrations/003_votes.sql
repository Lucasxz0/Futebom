-- ============================================================
-- Migração 003 — Votação de melhor/pior jogador por partida
-- Execute no Supabase: SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS match_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  voter_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  best_player  UUID REFERENCES players(id) ON DELETE SET NULL,
  worst_player UUID REFERENCES players(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, voter_id)  -- 1 voto por usuário por partida
);

CREATE INDEX IF NOT EXISTS match_votes_match_id_idx ON match_votes(match_id);

ALTER TABLE match_votes ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ler votos (para ver o resultado)
DROP POLICY IF EXISTS "match_votes: read all" ON match_votes;
CREATE POLICY "match_votes: read all" ON match_votes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Qualquer autenticado pode inserir 1 voto por partida (UNIQUE garante isso)
DROP POLICY IF EXISTS "match_votes: insert own" ON match_votes;
CREATE POLICY "match_votes: insert own" ON match_votes
  FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- Usuário pode atualizar só o próprio voto
DROP POLICY IF EXISTS "match_votes: update own" ON match_votes;
CREATE POLICY "match_votes: update own" ON match_votes
  FOR UPDATE USING (auth.uid() = voter_id);

-- Usuário pode deletar só o próprio voto
DROP POLICY IF EXISTS "match_votes: delete own" ON match_votes;
CREATE POLICY "match_votes: delete own" ON match_votes
  FOR DELETE USING (auth.uid() = voter_id);

-- REALTIME: habilitar em match_votes no Supabase → Replication → Tables

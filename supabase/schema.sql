-- ============================================================
-- Pelada App — Schema Supabase
-- Execute este arquivo no Supabase: SQL Editor → New Query
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PLAYERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('permanent', 'casual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS players_user_id_idx ON players(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS players_user_name_unique
  ON players(user_id, lower(name));

-- RLS (Row Level Security) — cada usuário vê apenas seus próprios jogadores
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players: owner select" ON players
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "players: owner insert" ON players
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "players: owner update" ON players
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "players: owner delete" ON players
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- MATCHES (será usado na Fase 3)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'Pelada',
  access_code  TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting', 'in_progress', 'finished')),
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches: read by code" ON matches
  FOR SELECT USING (true); -- acesso por código, qualquer autenticado pode ler

CREATE POLICY "matches: creator insert" ON matches
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "matches: creator update" ON matches
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "matches: creator delete" ON matches
  FOR DELETE USING (auth.uid() = creator_id);

-- ────────────────────────────────────────────────────────────
-- TEAMS (será usado na Fase 3)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id  UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name      TEXT NOT NULL, -- ex: "Time A", "Time B"
  color     TEXT NOT NULL DEFAULT '#1D4ED8',
  score     INT NOT NULL DEFAULT 0
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams: read all" ON teams
  FOR SELECT USING (true);

CREATE POLICY "teams: insert by match creator" ON teams
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT creator_id FROM matches WHERE id = match_id)
  );

CREATE POLICY "teams: update by match creator" ON teams
  FOR UPDATE USING (
    auth.uid() = (SELECT creator_id FROM matches WHERE id = match_id)
  );

-- ────────────────────────────────────────────────────────────
-- MATCH_PLAYERS (será usado na Fase 3)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_players (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id  UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id   UUID REFERENCES teams(id) ON DELETE SET NULL,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position  INT -- ordem no time (opcional)
);

ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_players: read all" ON match_players
  FOR SELECT USING (true);

CREATE POLICY "match_players: creator write" ON match_players
  FOR ALL USING (
    auth.uid() = (SELECT creator_id FROM matches WHERE id = match_id)
  );

-- ────────────────────────────────────────────────────────────
-- MATCH_EVENTS (será usado na Fase 4)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id     UUID REFERENCES teams(id) ON DELETE SET NULL,
  player_id   UUID REFERENCES players(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN ('goal', 'assist', 'substitution')),
  minute      INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_events: read all" ON match_events
  FOR SELECT USING (true);

CREATE POLICY "match_events: authenticated write" ON match_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────
-- PLAYER_STATS (será usado na Fase 7)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  goals           INT NOT NULL DEFAULT 0,
  assists         INT NOT NULL DEFAULT 0,
  wins            INT NOT NULL DEFAULT 0,
  losses          INT NOT NULL DEFAULT 0,
  matches_played  INT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_stats: read all" ON player_stats
  FOR SELECT USING (true);

CREATE POLICY "player_stats: owner write" ON player_stats
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM players WHERE id = player_id)
  );

-- ────────────────────────────────────────────────────────────
-- REALTIME (habilitar nas tabelas que precisam de sync ao vivo)
-- ────────────────────────────────────────────────────────────
-- Rode no Supabase → Database → Replication → Tables
-- Habilite: teams, match_players, match_events

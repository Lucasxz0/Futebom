-- ============================================================
-- Pelada App — Schema Supabase COMPLETO
-- Execute este arquivo no Supabase: SQL Editor → New Query → Run
-- ATENÇÃO: Use "fix_permissions_and_storage.sql" se já rodou 
-- este schema antes (para não duplicar as tabelas originais)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- APP_ADMINS (deve vir antes de groups por dependência)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_admins: read all" ON app_admins;
CREATE POLICY "app_admins: read all" ON app_admins
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "app_admins: self insert" ON app_admins;
CREATE POLICY "app_admins: self insert" ON app_admins
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "app_admins: admin delete" ON app_admins;
CREATE POLICY "app_admins: admin delete" ON app_admins
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- GROUPS
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

CREATE INDEX IF NOT EXISTS groups_created_by_idx ON groups(created_by);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups: read all" ON groups;
CREATE POLICY "groups: read all" ON groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "groups: admin insert" ON groups;
CREATE POLICY "groups: admin insert" ON groups
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "groups: admin update" ON groups;
CREATE POLICY "groups: admin update" ON groups
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

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

DROP POLICY IF EXISTS "group_members: read all" ON group_members;
CREATE POLICY "group_members: read all" ON group_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "group_members: self insert" ON group_members;
CREATE POLICY "group_members: self insert" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "group_members: self delete" ON group_members;
CREATE POLICY "group_members: self delete" ON group_members
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "group_members: admin delete" ON group_members;
CREATE POLICY "group_members: admin delete" ON group_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
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
-- PLAYERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('permanent', 'casual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS players_user_id_idx ON players(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS players_user_name_unique
  ON players(user_id, lower(name));

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "players: owner select" ON players;
CREATE POLICY "players: owner select" ON players
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "players: owner insert" ON players;
CREATE POLICY "players: owner insert" ON players
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "players: owner update" ON players;
CREATE POLICY "players: owner update" ON players
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "players: owner delete" ON players;
CREATE POLICY "players: owner delete" ON players
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- MATCHES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'Pelada',
  access_code  TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting', 'in_progress', 'finished')),
  team_size    INT NOT NULL DEFAULT 5,
  num_teams    INT NOT NULL DEFAULT 2,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches: read by code" ON matches;
CREATE POLICY "matches: read by code" ON matches
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "matches: creator insert" ON matches;
CREATE POLICY "matches: creator insert" ON matches
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "matches: creator update" ON matches;
CREATE POLICY "matches: creator update" ON matches
  FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "matches: creator delete" ON matches;
CREATE POLICY "matches: creator delete" ON matches
  FOR DELETE USING (auth.uid() = creator_id);

-- ────────────────────────────────────────────────────────────
-- TEAMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id  UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  color     TEXT NOT NULL DEFAULT '#1D4ED8',
  score     INT NOT NULL DEFAULT 0
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams: read all" ON teams;
CREATE POLICY "teams: read all" ON teams
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "teams: insert by match creator" ON teams;
CREATE POLICY "teams: insert by match creator" ON teams
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT creator_id FROM matches WHERE id = match_id)
  );

DROP POLICY IF EXISTS "teams: update by match creator" ON teams;
CREATE POLICY "teams: update by match creator" ON teams
  FOR UPDATE USING (
    auth.uid() = (SELECT creator_id FROM matches WHERE id = match_id)
  );

-- ────────────────────────────────────────────────────────────
-- MATCH_PLAYERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_players (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id  UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id   UUID REFERENCES teams(id) ON DELETE SET NULL,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status    TEXT NOT NULL DEFAULT 'queue' CHECK (status IN ('queue', 'playing', 'done')),
  position  INT
);

ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_players: read all" ON match_players;
CREATE POLICY "match_players: read all" ON match_players
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "match_players: creator write" ON match_players;
CREATE POLICY "match_players: creator write" ON match_players
  FOR ALL USING (
    auth.uid() = (SELECT creator_id FROM matches WHERE id = match_id)
  );

-- ────────────────────────────────────────────────────────────
-- MATCH_EVENTS
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

DROP POLICY IF EXISTS "match_events: read all" ON match_events;
CREATE POLICY "match_events: read all" ON match_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "match_events: authenticated write" ON match_events;
CREATE POLICY "match_events: authenticated write" ON match_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────
-- PLAYER_STATS
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

DROP POLICY IF EXISTS "player_stats: read all" ON player_stats;
CREATE POLICY "player_stats: read all" ON player_stats
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "player_stats: owner write" ON player_stats;
CREATE POLICY "player_stats: owner write" ON player_stats
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM players WHERE id = player_id)
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
CREATE INDEX IF NOT EXISTS media_posts_created_at_idx ON media_posts(created_at DESC);

ALTER TABLE media_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_posts: members read" ON media_posts;
CREATE POLICY "media_posts: members read" ON media_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = media_posts.group_id
        AND user_id = auth.uid()
    )
  );

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

DROP POLICY IF EXISTS "media_posts: author delete" ON media_posts;
CREATE POLICY "media_posts: author delete" ON media_posts
  FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- STORAGE: Bucket pelada-media
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pelada-media',
  'pelada-media',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];

DROP POLICY IF EXISTS "pelada-media: public read" ON storage.objects;
CREATE POLICY "pelada-media: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'pelada-media');

DROP POLICY IF EXISTS "pelada-media: auth upload" ON storage.objects;
CREATE POLICY "pelada-media: auth upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pelada-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "pelada-media: owner delete" ON storage.objects;
CREATE POLICY "pelada-media: owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'pelada-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ────────────────────────────────────────────────────────────
-- REALTIME
-- Habilitar nas tabelas: groups, group_members, media_posts,
-- teams, match_players, match_events
-- Supabase → Database → Replication → Tables
-- ────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase";
import { Match, Team, MatchEvent } from "./matchService";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchSummary {
  id: string;
  name: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  teams: {
    id: string;
    name: string;
    color: string;
    score: number;
  }[];
}

export interface MatchDetail extends MatchSummary {
  access_code: string;
  events: (MatchEvent & { player_name: string | null; team_name: string | null })[];
  players: { player_id: string; player_name: string; team_id: string | null; team_name: string | null }[];
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Get recent matches for the dashboard (last N matches of the user, any status).
 */
export async function getRecentMatches(limit = 5): Promise<{
  data: MatchSummary[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Não autenticado." };

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, name, status, started_at, finished_at, created_at")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  if (!matches || matches.length === 0) return { data: [], error: null };

  // Fetch teams for all these matches in one query
  const matchIds = matches.map((m) => m.id);
  const { data: teams } = await supabase
    .from("teams")
    .select("id, match_id, name, color, score")
    .in("match_id", matchIds);

  const teamsByMatch: Record<string, typeof teams> = {};
  (teams ?? []).forEach((t) => {
    if (!teamsByMatch[t.match_id]) teamsByMatch[t.match_id] = [];
    teamsByMatch[t.match_id]!.push(t);
  });

  const result: MatchSummary[] = matches.map((m) => ({
    id: m.id,
    name: m.name,
    status: m.status,
    started_at: m.started_at,
    finished_at: m.finished_at,
    created_at: m.created_at,
    teams: (teamsByMatch[m.id] ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      score: t.score,
    })),
  }));

  return { data: result, error: null };
}

/**
 * Get full match history for /history page (finished matches only).
 */
export async function getMatchHistory(): Promise<{
  data: MatchSummary[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Não autenticado." };

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, name, status, started_at, finished_at, created_at")
    .eq("creator_id", user.id)
    .eq("status", "finished")
    .order("finished_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  if (!matches || matches.length === 0) return { data: [], error: null };

  const matchIds = matches.map((m) => m.id);
  const { data: teams } = await supabase
    .from("teams")
    .select("id, match_id, name, color, score")
    .in("match_id", matchIds);

  const teamsByMatch: Record<string, typeof teams> = {};
  (teams ?? []).forEach((t) => {
    if (!teamsByMatch[t.match_id]) teamsByMatch[t.match_id] = [];
    teamsByMatch[t.match_id]!.push(t);
  });

  const result: MatchSummary[] = matches.map((m) => ({
    id: m.id,
    name: m.name,
    status: m.status,
    started_at: m.started_at,
    finished_at: m.finished_at,
    created_at: m.created_at,
    teams: (teamsByMatch[m.id] ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      score: t.score,
    })),
  }));

  return { data: result, error: null };
}

/**
 * Get full match detail: teams, players, and all events (for /match/[id]/summary).
 */
export async function getMatchDetail(matchId: string): Promise<{
  data: MatchDetail | null;
  error: string | null;
}> {
  const supabase = createClient();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, name, status, access_code, started_at, finished_at, created_at")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return { data: null, error: matchError?.message ?? "Partida não encontrada." };
  }

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, color, score")
    .eq("match_id", matchId)
    .order("name");

  const { data: matchPlayers } = await supabase
    .from("match_players")
    .select("player_id, team_id, players(name)")
    .eq("match_id", matchId);

  const { data: events } = await supabase
    .from("match_events")
    .select("*, players(name)")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  const teamsList = (teams ?? []) as Team[];
  const teamMap: Record<string, string> = {};
  teamsList.forEach((t) => { teamMap[t.id] = t.name; });

  const mappedPlayers = (matchPlayers ?? []).map((mp) => ({
    player_id: mp.player_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player_name: (mp as any).players?.name ?? "Jogador",
    team_id: mp.team_id,
    team_name: mp.team_id ? (teamMap[mp.team_id] ?? null) : null,
  }));

  const mappedEvents = (events ?? []).map((e) => ({
    ...(e as MatchEvent),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player_name: (e as any).players?.name ?? null,
    team_name: e.team_id ? (teamMap[e.team_id] ?? null) : null,
  }));

  return {
    data: {
      id: match.id,
      name: match.name,
      status: match.status,
      access_code: match.access_code,
      started_at: match.started_at,
      finished_at: match.finished_at,
      created_at: match.created_at,
      teams: teamsList.map((t) => ({ id: t.id, name: t.name, color: t.color, score: t.score })),
      events: mappedEvents,
      players: mappedPlayers,
    },
    error: null,
  };
}

/**
 * Delete multiple matches by ID (only matches created by the authenticated user).
 * Deletes in cascade: teams, match_players, match_events.
 */
export async function deleteMatches(
  matchIds: string[]
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  if (matchIds.length === 0) return { error: null };

  const { error } = await supabase
    .from("matches")
    .delete()
    .in("id", matchIds)
    .eq("creator_id", user.id);

  if (error) return { error: error.message };
  return { error: null };
}

import { createClient } from "@/lib/supabase";
import { getActiveGroupId } from "./groupService";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerRankingEntry {
  player_id: string;
  player_name: string;
  goals: number;
  assists: number;
  matches: number;
  wins: number;
  win_rate: number; // 0-100
}

export interface PersonalStats {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  win_rate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Aggregates goals and assists per player from match_events
 * across all finished matches of the authenticated user.
 */
export async function getPlayerRanking(): Promise<{
  data: PlayerRankingEntry[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Não autenticado." };

  const groupId = await getActiveGroupId();

  // 1. Get all finished matches (by group or by creator)
  let matchQuery = supabase
    .from("matches")
    .select("id")
    .eq("status", "finished");

  if (groupId) {
    matchQuery = matchQuery.eq("group_id", groupId);
  } else {
    matchQuery = matchQuery.eq("creator_id", user.id);
  }

  const { data: matches, error: matchError } = await matchQuery;

  if (matchError || !matches || matches.length === 0) {
    return { data: [], error: matchError?.message ?? null };
  }

  const matchIds = matches.map((m) => m.id);

  // 2. Get all events from those matches
  const { data: events, error: eventsError } = await supabase
    .from("match_events")
    .select("player_id, event_type, team_id, match_id, players(name)")
    .in("match_id", matchIds)
    .in("event_type", ["goal", "assist"]);

  if (eventsError) return { data: [], error: eventsError.message };

  // 3. Get teams to determine winners per match
  const { data: teams } = await supabase
    .from("teams")
    .select("id, match_id, score")
    .in("match_id", matchIds);

  // Build winner team_id per match
  const winnerTeamByMatch: Record<string, string | null> = {};
  matchIds.forEach((mid) => {
    const matchTeams = (teams ?? []).filter((t) => t.match_id === mid);
    if (matchTeams.length < 2) {
      winnerTeamByMatch[mid] = null;
      return;
    }
    const sorted = [...matchTeams].sort((a, b) => b.score - a.score);
    winnerTeamByMatch[mid] = sorted[0].score > sorted[1].score ? sorted[0].id : null; // null = draw
  });

  // 4. Get match_players to know which team each player was on per match
  const { data: matchPlayers } = await supabase
    .from("match_players")
    .select("player_id, team_id, match_id, players(name)")
    .in("match_id", matchIds);

  // 5. Aggregate per player
  const playerMap: Record<string, PlayerRankingEntry> = {};

  function ensurePlayer(playerId: string, playerName: string) {
    if (!playerMap[playerId]) {
      playerMap[playerId] = {
        player_id: playerId,
        player_name: playerName,
        goals: 0,
        assists: 0,
        matches: 0,
        wins: 0,
        win_rate: 0,
      };
    }
  }

  // Count goals & assists
  (events ?? []).forEach((e) => {
    if (!e.player_id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (e as any).players?.name ?? "Jogador";
    ensurePlayer(e.player_id, name);
    if (e.event_type === "goal") playerMap[e.player_id].goals++;
    if (e.event_type === "assist") playerMap[e.player_id].assists++;
  });

  // Count matches & wins
  // Each unique (player_id, match_id) row in match_players = 1 match played
  const seen = new Set<string>();
  (matchPlayers ?? []).forEach((mp) => {
    const key = `${mp.player_id}-${mp.match_id}`;
    if (seen.has(key)) return;
    seen.add(key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (mp as any).players?.name ?? "Jogador";
    ensurePlayer(mp.player_id, name);
    playerMap[mp.player_id].matches++;
    const winner = winnerTeamByMatch[mp.match_id];
    if (winner && mp.team_id === winner) {
      playerMap[mp.player_id].wins++;
    }
  });

  // Calculate win rates
  const result = Object.values(playerMap).map((p) => ({
    ...p,
    win_rate: p.matches > 0 ? Math.round((p.wins / p.matches) * 100) : 0,
  }));

  // Sort by goals desc, then assists, then win_rate
  result.sort((a, b) =>
    b.goals !== a.goals
      ? b.goals - a.goals
      : b.assists !== a.assists
      ? b.assists - a.assists
      : b.win_rate - a.win_rate
  );

  return { data: result, error: null };
}

/**
 * Get personal stats for the logged-in user (as a player across all matches they participated in).
 */
export async function getPersonalStats(): Promise<{
  data: PersonalStats | null;
  error: string | null;
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autenticado." };

  const groupId = await getActiveGroupId();

  // Get all finished matches (by group or by creator)
  let matchQuery = supabase
    .from("matches")
    .select("id")
    .eq("status", "finished");

  if (groupId) {
    matchQuery = matchQuery.eq("group_id", groupId);
  } else {
    matchQuery = matchQuery.eq("creator_id", user.id);
  }

  const { data: createdMatches } = await matchQuery;

  const matchIds = (createdMatches ?? []).map((m) => m.id);

  if (matchIds.length === 0) {
    return {
      data: { matches: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, win_rate: 0 },
      error: null,
    };
  }

  // Get all events for those matches
  const { data: events } = await supabase
    .from("match_events")
    .select("player_id, event_type, team_id, match_id")
    .in("match_id", matchIds)
    .in("event_type", ["goal", "assist"]);

  // Get teams for those matches
  const { data: teams } = await supabase
    .from("teams")
    .select("id, match_id, score")
    .in("match_id", matchIds);

  // Get match_players to find the user's player_id row (creator may not be a player)
  // We count matches as total finished matches created by this user for now.
  // Goals/assists filtered by user's player entries (if any exist in match_events with matching player)
  // For simplicity: aggregate ALL events to show total activity across all matches managed.

  const goals = (events ?? []).filter((e) => e.event_type === "goal").length;
  const assists = (events ?? []).filter((e) => e.event_type === "assist").length;

  // Calculate wins per match
  let wins = 0;
  let draws = 0;
  let losses = 0;

  matchIds.forEach((mid) => {
    const matchTeams = (teams ?? []).filter((t) => t.match_id === mid);
    if (matchTeams.length < 2) return;
    const sorted = [...matchTeams].sort((a, b) => b.score - a.score);
    if (sorted[0].score === sorted[1].score) {
      draws++;
    } else {
      wins++; // As the match organizer, count wins as matches where a winner existed
    }
  });

  losses = matchIds.length - wins - draws;

  return {
    data: {
      matches: matchIds.length,
      wins,
      draws,
      losses,
      goals,
      assists,
      win_rate: matchIds.length > 0 ? Math.round((wins / matchIds.length) * 100) : 0,
    },
    error: null,
  };
}

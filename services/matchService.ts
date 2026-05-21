import { createClient } from "@/lib/supabase";
import { generateAccessCode } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchStatus = "waiting" | "in_progress" | "finished";

export interface Match {
  id: string;
  creator_id: string;
  name: string;
  access_code: string;
  status: MatchStatus;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  match_id: string;
  name: string;
  color: string;
  score: number;
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  team_id: string | null;
  player_id: string;
  position: number | null;
}

export interface MatchWithTeams extends Match {
  teams: (Team & { players: { player_id: string; player_name: string }[] })[];
}

export interface CreateMatchInput {
  name: string;
  playerIds: string[]; // IDs dos jogadores selecionados
  teamSize: number;    // jogadores por time
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Distribui jogadores em 2 times de forma aleatória e balanceada.
 * Se teamSize < total de jogadores, os excedentes ficam como reservas (team_id = null).
 */
function splitIntoTeams(
  playerIds: string[],
  teamAId: string,
  teamBId: string,
  teamSize: number
): { player_id: string; team_id: string | null; position: number }[] {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const result: { player_id: string; team_id: string | null; position: number }[] = [];

  shuffled.forEach((pid, i) => {
    if (i < teamSize) {
      result.push({ player_id: pid, team_id: teamAId, position: i + 1 });
    } else if (i < teamSize * 2) {
      result.push({ player_id: pid, team_id: teamBId, position: i - teamSize + 1 });
    } else {
      // Reserva
      result.push({ player_id: pid, team_id: null, position: i + 1 });
    }
  });

  return result;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Create a new match with two teams and distribute selected players.
 */
export async function createMatch(
  input: CreateMatchInput
): Promise<{ data: Match | null; error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: "Usuário não autenticado." };

  // Generate a unique access code (retry once on collision)
  let accessCode = generateAccessCode(6);
  const { data: existing } = await supabase
    .from("matches")
    .select("id")
    .eq("access_code", accessCode)
    .maybeSingle();

  if (existing) accessCode = generateAccessCode(6);

  // 1. Insert match
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      creator_id: user.id,
      name: input.name.trim() || "Pelada",
      access_code: accessCode,
      status: "waiting",
    })
    .select()
    .single();

  if (matchError || !match) {
    return { data: null, error: matchError?.message ?? "Erro ao criar partida." };
  }

  // 2. Insert teams
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .insert([
      { match_id: match.id, name: "Time A", color: "#1D4ED8", score: 0 },
      { match_id: match.id, name: "Time B", color: "#EF4444", score: 0 },
    ])
    .select();

  if (teamsError || !teams || teams.length < 2) {
    // Rollback match
    await supabase.from("matches").delete().eq("id", match.id);
    return { data: null, error: teamsError?.message ?? "Erro ao criar times." };
  }

  const [teamA, teamB] = teams as Team[];

  // 3. Distribute players
  const assignments = splitIntoTeams(
    input.playerIds,
    teamA.id,
    teamB.id,
    input.teamSize
  );

  const matchPlayersRows = assignments.map((a) => ({
    match_id: match.id,
    team_id: a.team_id,
    player_id: a.player_id,
    position: a.position,
  }));

  const { error: mpError } = await supabase
    .from("match_players")
    .insert(matchPlayersRows);

  if (mpError) {
    // Rollback
    await supabase.from("matches").delete().eq("id", match.id);
    return { data: null, error: mpError.message };
  }

  return { data: match as Match, error: null };
}

/**
 * Fetch a match by its ID, including teams and player names.
 */
export async function getMatchById(
  id: string
): Promise<{ data: MatchWithTeams | null; error: string | null }> {
  const supabase = createClient();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();

  if (matchError || !match) {
    return { data: null, error: matchError?.message ?? "Partida não encontrada." };
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("*")
    .eq("match_id", id)
    .order("name");

  if (teamsError) return { data: null, error: teamsError.message };

  // Fetch match_players with player names
  const { data: matchPlayers, error: mpError } = await supabase
    .from("match_players")
    .select("team_id, player_id, players(name)")
    .eq("match_id", id);

  if (mpError) return { data: null, error: mpError.message };

  const teamsWithPlayers = (teams as Team[]).map((team) => ({
    ...team,
    players: (matchPlayers ?? [])
      .filter((mp) => mp.team_id === team.id)
      .map((mp) => ({
        player_id: mp.player_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        player_name: (mp as any).players?.name ?? "Jogador",
      })),
  }));

  // Reservas (sem time)
  const reserves = (matchPlayers ?? [])
    .filter((mp) => mp.team_id === null)
    .map((mp) => ({
      player_id: mp.player_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      player_name: (mp as any).players?.name ?? "Jogador",
    }));

  return {
    data: {
      ...(match as Match),
      teams: teamsWithPlayers,
      // Attach reserves as a virtual "Reservas" team if any
      ...(reserves.length > 0
        ? {
            teams: [
              ...teamsWithPlayers,
              {
                id: "reserves",
                match_id: id,
                name: "Reservas",
                color: "#64748B",
                score: 0,
                players: reserves,
              },
            ],
          }
        : {}),
    } as MatchWithTeams,
    error: null,
  };
}

/**
 * Find a match by access code (case-insensitive).
 * Returns the match ID so the user can be redirected to the lobby.
 */
export async function findMatchByCode(
  code: string
): Promise<{ matchId: string | null; error: string | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("matches")
    .select("id, status")
    .eq("access_code", code.trim().toUpperCase())
    .maybeSingle();

  if (error) return { matchId: null, error: error.message };
  if (!data) return { matchId: null, error: "Código inválido. Partida não encontrada." };
  if (data.status === "finished") {
    return { matchId: null, error: "Esta partida já foi encerrada." };
  }

  return { matchId: data.id, error: null };
}

// ─── Live Match ───────────────────────────────────────────────────────────────

export interface MatchEvent {
  id: string;
  match_id: string;
  team_id: string | null;
  player_id: string | null;
  event_type: "goal" | "assist" | "substitution";
  minute: number | null;
  created_at: string;
  player_name?: string; // joined
}

export interface LiveMatchData {
  match: Match;
  teams: (Team & { players: { player_id: string; player_name: string }[] })[];
  events: MatchEvent[];
}

/**
 * Start a match: set status to 'in_progress' and record started_at.
 */
export async function startMatch(
  matchId: string
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("matches")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", matchId);

  return { error: error?.message ?? null };
}

/**
 * Register a goal (and optionally an assist) for a team.
 * Increments team score and inserts event row(s).
 */
export async function registerGoal(params: {
  matchId: string;
  teamId: string;
  scorerId: string | null;
  assistId?: string | null;
  minute: number;
}): Promise<{ error: string | null }> {
  const supabase = createClient();

  // 1. Increment team score
  const { data: team } = await supabase
    .from("teams")
    .select("score")
    .eq("id", params.teamId)
    .single();

  const currentScore = (team as Team | null)?.score ?? 0;

  const { error: scoreError } = await supabase
    .from("teams")
    .update({ score: currentScore + 1 })
    .eq("id", params.teamId);

  if (scoreError) return { error: scoreError.message };

  // 2. Insert goal event
  const events: {
    match_id: string;
    team_id: string;
    player_id: string | null;
    event_type: "goal" | "assist";
    minute: number;
  }[] = [
    {
      match_id: params.matchId,
      team_id: params.teamId,
      player_id: params.scorerId,
      event_type: "goal",
      minute: params.minute,
    },
  ];

  // 3. Insert assist event if provided
  if (params.assistId) {
    events.push({
      match_id: params.matchId,
      team_id: params.teamId,
      player_id: params.assistId,
      event_type: "assist",
      minute: params.minute,
    });
  }

  const { error: eventError } = await supabase
    .from("match_events")
    .insert(events);

  return { error: eventError?.message ?? null };
}

/**
 * Undo the last goal of a team (decrement score and delete last goal event).
 */
export async function undoLastGoal(params: {
  matchId: string;
  teamId: string;
}): Promise<{ error: string | null }> {
  const supabase = createClient();

  // Find last goal event for this team
  const { data: lastEvent } = await supabase
    .from("match_events")
    .select("id")
    .eq("match_id", params.matchId)
    .eq("team_id", params.teamId)
    .eq("event_type", "goal")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastEvent) return { error: "Nenhum gol para desfazer." };

  // Delete the goal event
  await supabase.from("match_events").delete().eq("id", lastEvent.id);

  // Decrement score
  const { data: team } = await supabase
    .from("teams")
    .select("score")
    .eq("id", params.teamId)
    .single();

  const currentScore = (team as Team | null)?.score ?? 0;
  const { error } = await supabase
    .from("teams")
    .update({ score: Math.max(0, currentScore - 1) })
    .eq("id", params.teamId);

  return { error: error?.message ?? null };
}

/**
 * Finish a match: set status to 'finished' and record finished_at.
 */
export async function finishMatch(
  matchId: string
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("matches")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("id", matchId);

  return { error: error?.message ?? null };
}

/**
 * Get all events for a match (with player names joined).
 */
export async function getMatchEvents(
  matchId: string
): Promise<{ data: MatchEvent[]; error: string | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("match_events")
    .select("*, players(name)")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (error) return { data: [], error: error.message };

  const events = (data ?? []).map((e) => ({
    ...e,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player_name: (e as any).players?.name ?? null,
  })) as MatchEvent[];

  return { data: events, error: null };
}

// ─── Phase 5: Substitutions ───────────────────────────────────────────────────

export interface LivePlayer {
  match_player_id: string;
  player_id: string;
  player_name: string;
  team_id: string | null; // null = reserve/bench
}

/**
 * Get all match_players for a match with player names, split into active (on a team) and reserves.
 */
export async function getLiveMatchPlayers(matchId: string): Promise<{
  active: LivePlayer[];
  reserves: LivePlayer[];
  error: string | null;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("match_players")
    .select("id, player_id, team_id, players(name)")
    .eq("match_id", matchId);

  if (error) return { active: [], reserves: [], error: error.message };

  const all: LivePlayer[] = (data ?? []).map((row) => ({
    match_player_id: row.id,
    player_id: row.player_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player_name: (row as any).players?.name ?? "Jogador",
    team_id: row.team_id,
  }));

  return {
    active: all.filter((p) => p.team_id !== null),
    reserves: all.filter((p) => p.team_id === null),
    error: null,
  };
}

/**
 * Perform a substitution:
 * - The outgoing player's team_id is set to null (goes to bench)
 * - The incoming player's team_id is set to the team's id (enters the match)
 * - A substitution event is recorded in match_events
 */
export async function performSubstitution(params: {
  matchId: string;
  teamId: string;
  outPlayerId: string;    // player going to bench
  inPlayerId: string;     // player entering the field
  minute: number;
}): Promise<{ error: string | null }> {
  const supabase = createClient();

  // 1. Move outgoing player to bench (team_id = null)
  const { error: outError } = await supabase
    .from("match_players")
    .update({ team_id: null })
    .eq("match_id", params.matchId)
    .eq("player_id", params.outPlayerId);

  if (outError) return { error: outError.message };

  // 2. Move incoming player to team
  const { error: inError } = await supabase
    .from("match_players")
    .update({ team_id: params.teamId })
    .eq("match_id", params.matchId)
    .eq("player_id", params.inPlayerId);

  if (inError) return { error: inError.message };

  // 3. Register substitution event (player_id = the one entering)
  const { error: eventError } = await supabase
    .from("match_events")
    .insert({
      match_id: params.matchId,
      team_id: params.teamId,
      player_id: params.inPlayerId,
      event_type: "substitution",
      minute: params.minute,
    });

  return { error: eventError?.message ?? null };
}

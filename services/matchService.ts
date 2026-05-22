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
  // Timer sync fields (added via migration)
  timer_started_at: string | null;
  timer_offset_seconds: number;
  timer_paused: boolean;
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
  queue_position: number | null;
}

export interface MatchWithTeams extends Match {
  teams: (Team & { players: { player_id: string; player_name: string }[] })[];
}

export interface CreateMatchInput {
  name: string;
  /** IDs dos jogadores já ordenados por ordem de chegada (created_at asc) */
  playerIds: string[];
  teamSize: number;
  /**
   * true  → primeira partida: embaralha os primeiros (teamSize*2) jogadores nos times,
   *         o resto vai para a fila em ordem.
   * false → partidas seguintes: distribui em ordem direta, sem embaralhar.
   */
  isFirstMatch?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Distribui jogadores em 2 times e fila.
 *
 * isFirstMatch=true  → os primeiros (teamSize*2) são sorteados (embaralhados) entre
 *                       os dois times; os demais vão para a fila em ordem de chegada.
 * isFirstMatch=false → distribui em ordem direta sem embaralhar.
 */
function splitIntoTeams(
  playerIds: string[],
  teamAId: string,
  teamBId: string,
  teamSize: number,
  isFirstMatch: boolean
): {
  player_id: string;
  team_id: string | null;
  position: number | null;
  queue_position: number | null;
}[] {
  const result: {
    player_id: string;
    team_id: string | null;
    position: number | null;
    queue_position: number | null;
  }[] = [];

  const playersPerMatch = teamSize * 2;

  if (isFirstMatch) {
    // Sorteio: pega os primeiros (teamSize*2), embaralha, distribui
    const firstGroup = playerIds.slice(0, playersPerMatch);
    const rest = playerIds.slice(playersPerMatch);

    const shuffled = [...firstGroup].sort(() => Math.random() - 0.5);

    shuffled.forEach((pid, i) => {
      if (i < teamSize) {
        result.push({ player_id: pid, team_id: teamAId, position: i + 1, queue_position: null });
      } else {
        result.push({ player_id: pid, team_id: teamBId, position: i - teamSize + 1, queue_position: null });
      }
    });

    // Restantes vão para a fila em ordem de chegada
    rest.forEach((pid, i) => {
      result.push({ player_id: pid, team_id: null, position: null, queue_position: i + 1 });
    });
  } else {
    // Ordem direta: sem embaralhamento
    playerIds.forEach((pid, i) => {
      if (i < teamSize) {
        result.push({ player_id: pid, team_id: teamAId, position: i + 1, queue_position: null });
      } else if (i < playersPerMatch) {
        result.push({ player_id: pid, team_id: teamBId, position: i - teamSize + 1, queue_position: null });
      } else {
        result.push({ player_id: pid, team_id: null, position: null, queue_position: i - playersPerMatch + 1 });
      }
    });
  }

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
      name: input.name.trim() || "Futebom",
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
    await supabase.from("matches").delete().eq("id", match.id);
    return { data: null, error: teamsError?.message ?? "Erro ao criar times." };
  }

  const [teamA, teamB] = teams as Team[];

  // 3. Distribute players
  const assignments = splitIntoTeams(
    input.playerIds,
    teamA.id,
    teamB.id,
    input.teamSize,
    input.isFirstMatch ?? true
  );

  const matchPlayersRows = assignments.map((a) => ({
    match_id: match.id,
    team_id: a.team_id,
    player_id: a.player_id,
    position: a.position,
    queue_position: a.queue_position,
  }));

  const { error: mpError } = await supabase
    .from("match_players")
    .insert(matchPlayersRows);

  if (mpError) {
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

  // Reservas / fila (sem time)
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
      ...(reserves.length > 0
        ? {
            teams: [
              ...teamsWithPlayers,
              {
                id: "reserves",
                match_id: id,
                name: "Próxima",
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
 * Start a match: set status to 'in_progress', record started_at, and initialize synced timer.
 */
export async function startMatch(
  matchId: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("matches")
    .update({
      status: "in_progress",
      started_at: now,
      timer_started_at: now,
      timer_offset_seconds: 0,
      timer_paused: false,
    })
    .eq("id", matchId);

  return { error: error?.message ?? null };
}

/**
 * Pause the match timer.
 * Saves current elapsed into timer_offset_seconds and marks as paused.
 */
export async function pauseTimer(
  matchId: string,
  currentElapsed: number
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("matches")
    .update({
      timer_paused: true,
      timer_offset_seconds: currentElapsed,
    })
    .eq("id", matchId);

  return { error: error?.message ?? null };
}

/**
 * Resume the match timer from where it was paused.
 */
export async function resumeTimer(
  matchId: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("matches")
    .update({
      timer_paused: false,
      timer_started_at: now,
    })
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

// ─── Substitutions & Queue ────────────────────────────────────────────────────

export interface LivePlayer {
  match_player_id: string;
  player_id: string;
  player_name: string;
  team_id: string | null;
  queue_position: number | null;
}

/**
 * Get all match_players for a match with player names.
 * Active players (on a team) and reserves (queue) sorted by queue_position.
 */
export async function getLiveMatchPlayers(matchId: string): Promise<{
  active: LivePlayer[];
  reserves: LivePlayer[]; // sorted by queue_position ascending
  error: string | null;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("match_players")
    .select("id, player_id, team_id, queue_position, players(name)")
    .eq("match_id", matchId);

  if (error) return { active: [], reserves: [], error: error.message };

  const all: LivePlayer[] = (data ?? []).map((row) => ({
    match_player_id: row.id,
    player_id: row.player_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player_name: (row as any).players?.name ?? "Jogador",
    team_id: row.team_id,
    queue_position: row.queue_position ?? null,
  }));

  const reserves = all
    .filter((p) => p.team_id === null)
    .sort((a, b) => (a.queue_position ?? 9999) - (b.queue_position ?? 9999));

  return {
    active: all.filter((p) => p.team_id !== null),
    reserves,
    error: null,
  };
}

/**
 * Perform a substitution:
 * - The outgoing player's team_id is set to null and goes to END of queue
 * - The incoming player's team_id is set to the team's id (queue_position cleared)
 * - A substitution event is recorded in match_events
 */
export async function performSubstitution(params: {
  matchId: string;
  teamId: string;
  outPlayerId: string;  // player going to bench (end of queue)
  inPlayerId: string;   // player entering the field
  minute: number;
}): Promise<{ error: string | null }> {
  const supabase = createClient();

  // Get current max queue_position to place outgoing player at end
  const { data: queueData } = await supabase
    .from("match_players")
    .select("queue_position")
    .eq("match_id", params.matchId)
    .is("team_id", null)
    .order("queue_position", { ascending: false })
    .limit(1)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxQueuePos = (queueData as any)?.queue_position ?? 0;

  // 1. Move outgoing player to end of queue
  const { error: outError } = await supabase
    .from("match_players")
    .update({ team_id: null, queue_position: maxQueuePos + 1 })
    .eq("match_id", params.matchId)
    .eq("player_id", params.outPlayerId);

  if (outError) return { error: outError.message };

  // 2. Move incoming player to team, clear queue position
  const { error: inError } = await supabase
    .from("match_players")
    .update({ team_id: params.teamId, queue_position: null })
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

/**
 * Create the next match when the current one ends.
 *
 * - Winning team stays as-is
 * - First teamSize players from the queue enter as the new team
 * - Losing team players go to END of new queue (after remaining queue players)
 * - No shuffle — purely by queue_position order
 */
export async function createNextMatch(params: {
  currentMatchId: string;
  losingTeamId: string;
  teamSize: number;
  matchName: string;
}): Promise<{ data: Match | null; error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: "Usuário não autenticado." };

  // Fetch all current match players
  const { data: currentPlayers, error: cpError } = await supabase
    .from("match_players")
    .select("player_id, team_id, queue_position")
    .eq("match_id", params.currentMatchId);

  if (cpError || !currentPlayers) {
    return { data: null, error: cpError?.message ?? "Erro ao buscar jogadores." };
  }

  // Fetch current teams
  const { data: currentTeams, error: ctError } = await supabase
    .from("teams")
    .select("id, name, color, score")
    .eq("match_id", params.currentMatchId);

  if (ctError || !currentTeams) {
    return { data: null, error: ctError?.message ?? "Erro ao buscar times." };
  }

  const winningTeam = currentTeams.find((t) => t.id !== params.losingTeamId);
  if (!winningTeam) return { data: null, error: "Time vencedor não encontrado." };
  const losingTeam = currentTeams.find((t) => t.id === params.losingTeamId);

  // Separate player groups
  const winnerPlayerIds = currentPlayers
    .filter((p) => p.team_id === winningTeam.id)
    .map((p) => p.player_id);

  const loserPlayerIds = currentPlayers
    .filter((p) => p.team_id === params.losingTeamId)
    .map((p) => p.player_id);

  // Queue sorted by position
  const queuePlayerIds = currentPlayers
    .filter((p) => p.team_id === null)
    .sort((a, b) => ((a.queue_position ?? 9999) - (b.queue_position ?? 9999)))
    .map((p) => p.player_id);

  // Next team = first teamSize from queue
  const nextTeamPlayerIds = queuePlayerIds.slice(0, params.teamSize);
  const remainingQueueIds = queuePlayerIds.slice(params.teamSize);

  if (nextTeamPlayerIds.length < params.teamSize) {
    return { data: null, error: "Não há jogadores suficientes na fila para a próxima partida." };
  }

  // New queue: remaining queue first, then losers at end
  const newQueueIds = [...remainingQueueIds, ...loserPlayerIds];

  // Generate access code
  let accessCode = generateAccessCode(6);
  const { data: existingCode } = await supabase
    .from("matches")
    .select("id")
    .eq("access_code", accessCode)
    .maybeSingle();
  if (existingCode) accessCode = generateAccessCode(6);

  // Create new match
  const { data: newMatch, error: matchError } = await supabase
    .from("matches")
    .insert({
      creator_id: user.id,
      name: params.matchName,
      access_code: accessCode,
      status: "waiting",
    })
    .select()
    .single();

  if (matchError || !newMatch) {
    return { data: null, error: matchError?.message ?? "Erro ao criar nova partida." };
  }

  // Create teams (preserve colors)
  const { data: newTeams, error: teamsError } = await supabase
    .from("teams")
    .insert([
      { match_id: newMatch.id, name: winningTeam.name, color: winningTeam.color, score: 0 },
      { match_id: newMatch.id, name: losingTeam?.name ?? "Time B", color: losingTeam?.color ?? "#EF4444", score: 0 },
    ])
    .select();

  if (teamsError || !newTeams || newTeams.length < 2) {
    await supabase.from("matches").delete().eq("id", newMatch.id);
    return { data: null, error: teamsError?.message ?? "Erro ao criar times." };
  }

  const [newWinnerTeam, newNextTeam] = newTeams as Team[];

  // Build match_players rows
  const rows: {
    match_id: string;
    team_id: string | null;
    player_id: string;
    position: number | null;
    queue_position: number | null;
  }[] = [];

  winnerPlayerIds.forEach((pid, i) => {
    rows.push({ match_id: newMatch.id, team_id: newWinnerTeam.id, player_id: pid, position: i + 1, queue_position: null });
  });

  nextTeamPlayerIds.forEach((pid, i) => {
    rows.push({ match_id: newMatch.id, team_id: newNextTeam.id, player_id: pid, position: i + 1, queue_position: null });
  });

  newQueueIds.forEach((pid, i) => {
    rows.push({ match_id: newMatch.id, team_id: null, player_id: pid, position: null, queue_position: i + 1 });
  });

  const { error: mpError } = await supabase.from("match_players").insert(rows);

  if (mpError) {
    await supabase.from("matches").delete().eq("id", newMatch.id);
    return { data: null, error: mpError.message };
  }

  return { data: newMatch as Match, error: null };
}

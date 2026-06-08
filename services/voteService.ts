import { createClient } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoteResult {
  player_id: string;
  player_name: string;
  votes: number;
  percentage: number;
}

export interface MatchVoteSummary {
  total_voters: number;
  best: VoteResult[];
  worst: VoteResult[];
  my_vote: {
    best_player: string | null;
    worst_player: string | null;
  } | null;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Submit or update the current user's vote for a match.
 * Uses upsert so re-voting updates the existing row.
 */
export async function submitVote(params: {
  matchId: string;
  bestPlayerId: string | null;
  worstPlayerId: string | null;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("match_votes").upsert(
    {
      match_id: params.matchId,
      voter_id: user.id,
      best_player: params.bestPlayerId,
      worst_player: params.worstPlayerId,
    },
    { onConflict: "match_id,voter_id" }
  );

  return { error: error?.message ?? null };
}

/**
 * Get the current user's vote for a specific match.
 */
export async function getMyVote(matchId: string): Promise<{
  data: { best_player: string | null; worst_player: string | null } | null;
  error: string | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autenticado." };

  const { data, error } = await supabase
    .from("match_votes")
    .select("best_player, worst_player")
    .eq("match_id", matchId)
    .eq("voter_id", user.id)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data ?? null, error: null };
}

/**
 * Get aggregated vote results for a match.
 * Returns top players by votes for best and worst categories.
 */
export async function getMatchVotes(matchId: string): Promise<{
  data: MatchVoteSummary | null;
  error: string | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autenticado." };

  // Get all votes for this match
  const { data: votes, error: votesError } = await supabase
    .from("match_votes")
    .select("voter_id, best_player, worst_player")
    .eq("match_id", matchId);

  if (votesError) return { data: null, error: votesError.message };

  // Get players in this match for name resolution
  const { data: matchPlayers } = await supabase
    .from("match_players")
    .select("player_id, players(name)")
    .eq("match_id", matchId);

  const playerNames: Record<string, string> = {};
  (matchPlayers ?? []).forEach((mp) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    playerNames[mp.player_id] = (mp as any).players?.name ?? "Jogador";
  });

  const allVotes = votes ?? [];
  const totalVoters = allVotes.length;

  // Count best votes
  const bestCount: Record<string, number> = {};
  const worstCount: Record<string, number> = {};

  allVotes.forEach((v) => {
    if (v.best_player) {
      bestCount[v.best_player] = (bestCount[v.best_player] ?? 0) + 1;
    }
    if (v.worst_player) {
      worstCount[v.worst_player] = (worstCount[v.worst_player] ?? 0) + 1;
    }
  });

  const toResults = (
    countMap: Record<string, number>
  ): VoteResult[] =>
    Object.entries(countMap)
      .map(([pid, count]) => ({
        player_id: pid,
        player_name: playerNames[pid] ?? "Jogador",
        votes: count,
        percentage: totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0,
      }))
      .sort((a, b) => b.votes - a.votes);

  // My vote
  const myVoteRow = allVotes.find((v) => v.voter_id === user.id);
  const myVote = myVoteRow
    ? {
        best_player: myVoteRow.best_player,
        worst_player: myVoteRow.worst_player,
      }
    : null;

  return {
    data: {
      total_voters: totalVoters,
      best: toResults(bestCount),
      worst: toResults(worstCount),
      my_vote: myVote,
    },
    error: null,
  };
}

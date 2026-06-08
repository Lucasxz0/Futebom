import { createClient } from "@/lib/supabase";
import { getActiveGroupId } from "./groupService";

export type PlayerType = "permanent" | "casual";

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  user_id: string;
  created_at: string;
  goals?: number;
  assists?: number;
  wins?: number;
  matches_played?: number;
}

export interface CreatePlayerInput {
  name: string;
  type: PlayerType;
}

export interface UpdatePlayerInput {
  name?: string;
  type?: PlayerType;
}

/**
 * Fetch all players belonging to the authenticated user,
 * ordered: permanent first, then casual, alphabetical within each group.
 */
export async function getPlayers(): Promise<{ data: Player[]; error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: [], error: "Usuário não autenticado." };

  const groupId = await getActiveGroupId();

  let query = supabase
    .from("players")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (groupId) {
    query = query.eq("group_id", groupId);
  } else {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: (data as Player[]) ?? [], error: null };
}

/**
 * Create a new player. Validates no duplicate name (case-insensitive) for this user.
 */
export async function createPlayer(
  input: CreatePlayerInput
): Promise<{ data: Player | null; error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: "Usuário não autenticado." };

  const trimmedName = input.name.trim();
  if (!trimmedName) return { data: null, error: "Nome não pode estar vazio." };

  const groupId = await getActiveGroupId();

  // Check for duplicate (case-insensitive) within group or user
  let dupQuery = supabase
    .from("players")
    .select("id")
    .ilike("name", trimmedName)
    .maybeSingle();

  if (groupId) {
    dupQuery = supabase.from("players").select("id").eq("group_id", groupId).ilike("name", trimmedName).maybeSingle();
  } else {
    dupQuery = supabase.from("players").select("id").eq("user_id", user.id).ilike("name", trimmedName).maybeSingle();
  }

  const { data: existing } = await dupQuery;

  if (existing) {
    return { data: null, error: `Já existe um jogador chamado "${trimmedName}".` };
  }

  const { data, error } = await supabase
    .from("players")
    .insert({ name: trimmedName, type: input.type, user_id: user.id, group_id: groupId ?? undefined })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Player, error: null };
}

/**
 * Update an existing player's name or type.
 * Validates no duplicate name (case-insensitive) for other players.
 */
export async function updatePlayer(
  id: string,
  input: UpdatePlayerInput
): Promise<{ data: Player | null; error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: "Usuário não autenticado." };

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    if (!trimmedName) return { data: null, error: "Nome não pode estar vazio." };
    input.name = trimmedName;

    // Check for duplicate (excluding current player)
    const { data: existing } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", trimmedName)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return { data: null, error: `Já existe um jogador chamado "${trimmedName}".` };
    }
  }

  const { data, error } = await supabase
    .from("players")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Player, error: null };
}

/**
 * Delete a player by ID (only if it belongs to the current user).
 */
export async function deletePlayer(
  id: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Usuário não autenticado." };

  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Create multiple players at once from a list of names.
 * Silently skips names that already exist (case-insensitive duplicate check).
 * Returns how many were created vs skipped.
 */
export async function createPlayersBulk(
  names: string[],
  type: PlayerType
): Promise<{ created: number; skipped: number; error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { created: 0, skipped: 0, error: "Usuário não autenticado." };

  const trimmed = names.map((n) => n.trim()).filter((n) => n.length >= 2);
  if (trimmed.length === 0) return { created: 0, skipped: 0, error: null };

  const groupId = await getActiveGroupId();

  // Fetch existing player names (for duplicate check)
  let existingQuery = supabase.from("players").select("name");
  if (groupId) {
    existingQuery = existingQuery.eq("group_id", groupId);
  } else {
    existingQuery = existingQuery.eq("user_id", user.id);
  }

  const { data: existing } = await existingQuery;

  const existingLower = new Set(
    (existing ?? []).map((p) => p.name.toLowerCase())
  );

  const toCreate = trimmed.filter((n) => !existingLower.has(n.toLowerCase()));
  const skipped = trimmed.length - toCreate.length;

  if (toCreate.length === 0) return { created: 0, skipped, error: null };

  const rows = toCreate.map((name) => ({
    name,
    type,
    user_id: user.id,
    ...(groupId ? { group_id: groupId } : {}),
  }));
  const { error } = await supabase.from("players").insert(rows);

  if (error) return { created: 0, skipped, error: error.message };

  return { created: toCreate.length, skipped, error: null };
}

/**
 * Delete multiple players at once (only players belonging to the current user).
 */
export async function deletePlayers(
  ids: string[]
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Usuário não autenticado." };
  if (ids.length === 0) return { error: null };

  const { error } = await supabase
    .from("players")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Reset stats for the given player IDs by deleting their match_events (goals/assists)
 * and match_players entries. This zeroes out goals, assists, matches played etc.
 * The match records themselves are preserved.
 */
export async function resetPlayerStats(
  playerIds: string[]
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Usuário não autenticado." };
  if (playerIds.length === 0) return { error: null };

  // Delete goal/assist events for these players
  const { error: eventsError } = await supabase
    .from("match_events")
    .delete()
    .in("player_id", playerIds)
    .in("event_type", ["goal", "assist"]);

  if (eventsError) return { error: eventsError.message };

  // Delete match_players entries so matches_played = 0
  const { error: mpError } = await supabase
    .from("match_players")
    .delete()
    .in("player_id", playerIds);

  if (mpError) return { error: mpError.message };

  return { error: null };
}

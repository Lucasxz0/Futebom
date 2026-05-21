import { createClient } from "@/lib/supabase";

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

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .order("type", { ascending: true }) // permanent < casual alphabetically
    .order("name", { ascending: true });

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

  // Check for duplicate (case-insensitive)
  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", trimmedName)
    .maybeSingle();

  if (existing) {
    return { data: null, error: `Já existe um jogador chamado "${trimmedName}".` };
  }

  const { data, error } = await supabase
    .from("players")
    .insert({ name: trimmedName, type: input.type, user_id: user.id })
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

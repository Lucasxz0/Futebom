"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Player,
  PlayerType,
  CreatePlayerInput,
  UpdatePlayerInput,
  getPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
} from "@/services/playerService";

interface UsePlayersReturn {
  players: Player[];
  permanentPlayers: Player[];
  casualPlayers: Player[];
  loading: boolean;
  error: string | null;
  addPlayer: (input: CreatePlayerInput) => Promise<{ error: string | null; data?: Player }>;
  editPlayer: (id: string, input: UpdatePlayerInput) => Promise<{ error: string | null }>;
  removePlayer: (id: string) => Promise<{ error: string | null }>;
  refresh: () => Promise<void>;
}

/**
 * Hook that wraps playerService with loading/error states and derived lists.
 * Automatically fetches players on mount.
 */
export function usePlayers(): UsePlayersReturn {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getPlayers();
    if (fetchError) {
      setError(fetchError);
    } else {
      setPlayers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addPlayer = useCallback(
    async (input: CreatePlayerInput): Promise<{ error: string | null; data?: Player }> => {
      const { data, error: createError } = await createPlayer(input);
      if (createError) return { error: createError };

      if (data) {
        // Optimistic insert + re-sort
        setPlayers((prev) =>
          [...prev, data].sort((a, b) => {
            if (a.type !== b.type) return a.type < b.type ? -1 : 1;
            return a.name.localeCompare(b.name, "pt-BR");
          })
        );
      }
      return { error: null, data: data as Player };
    },
    []
  );

  const editPlayer = useCallback(
    async (
      id: string,
      input: UpdatePlayerInput
    ): Promise<{ error: string | null }> => {
      const { data, error: updateError } = await updatePlayer(id, input);
      if (updateError) return { error: updateError };

      if (data) {
        setPlayers((prev) =>
          prev
            .map((p) => (p.id === id ? data : p))
            .sort((a, b) => {
              if (a.type !== b.type) return a.type < b.type ? -1 : 1;
              return a.name.localeCompare(b.name, "pt-BR");
            })
        );
      }
      return { error: null };
    },
    []
  );

  const removePlayer = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error: deleteError } = await deletePlayer(id);
      if (deleteError) return { error: deleteError };

      // Optimistic remove
      setPlayers((prev) => prev.filter((p) => p.id !== id));
      return { error: null };
    },
    []
  );

  const permanentPlayers = players.filter((p) => p.type === "permanent");
  const casualPlayers = players.filter((p) => p.type === "casual");

  return {
    players,
    permanentPlayers,
    casualPlayers,
    loading,
    error,
    addPlayer,
    editPlayer,
    removePlayer,
    refresh,
  };
}

export type { Player, PlayerType };

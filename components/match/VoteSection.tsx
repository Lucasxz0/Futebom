"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ThumbsDown, Check, Star, Flame, AlertCircle } from "lucide-react";
import {
  submitVote,
  getMatchVotes,
  MatchVoteSummary,
  VoteResult,
} from "@/services/voteService";
import { createClient } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  player_id: string;
  player_name: string;
}

interface VoteSectionProps {
  matchId: string;
  players: Player[];
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function VoteBar({ result, color }: { result: VoteResult; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2"
    >
      <p className="text-[#94A3B8] text-xs w-24 truncate shrink-0">
        {result.player_name}
      </p>
      <div className="flex-1 h-2 bg-[#0F172A] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${result.percentage}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-[#F1F5F9] text-xs font-bold w-8 text-right shrink-0">
        {result.percentage}%
      </span>
    </motion.div>
  );
}

// ─── Player Picker ────────────────────────────────────────────────────────────

function PlayerPicker({
  players,
  selected,
  onSelect,
  accentColor,
  excludeId,
}: {
  players: Player[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  accentColor: string;
  excludeId?: string | null;
}) {
  const eligible = players.filter((p) => p.player_id !== excludeId);

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {eligible.map((p) => {
        const isSelected = selected === p.player_id;
        const initials = p.player_name
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase();

        return (
          <motion.button
            key={p.player_id}
            whileTap={{ scale: 0.92 }}
            onClick={() => onSelect(isSelected ? null : p.player_id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
              isSelected
                ? "text-white shadow-lg"
                : "bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:border-[#475569]"
            }`}
            style={
              isSelected
                ? { background: accentColor, borderColor: accentColor }
                : {}
            }
          >
            <span
              className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                isSelected ? "bg-white/20 text-white" : "bg-[#334155] text-[#64748B]"
              }`}
            >
              {initials}
            </span>
            {p.player_name.split(" ")[0]}
            {isSelected && <Check size={12} className="shrink-0" />}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VoteSection({ matchId, players }: VoteSectionProps) {
  const [summary, setSummary] = useState<MatchVoteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Local picks (before or after submitting)
  const [bestPick, setBestPick] = useState<string | null>(null);
  const [worstPick, setWorstPick] = useState<string | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, isAuthenticated]);

  async function loadVotes() {
    setLoading(true);
    const { data, error: err } = await getMatchVotes(matchId);
    if (err) setError(err);
    else if (data) {
      setSummary(data);
      // Pre-fill with existing vote
      if (data.my_vote) {
        setBestPick(data.my_vote.best_player);
        setWorstPick(data.my_vote.worst_player);
      }
    }
    setLoading(false);
  }

  const hasVoted = summary?.my_vote !== null && summary?.my_vote !== undefined;

  async function handleSubmit() {
    if (!bestPick && !worstPick) {
      setError("Selecione pelo menos um jogador para votar.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: err } = await submitVote({
      matchId,
      bestPlayerId: bestPick,
      worstPlayerId: worstPick,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setSuccess(true);
      await loadVotes();
      setTimeout(() => setSuccess(false), 2000);
    }
  }

  if (!isAuthenticated) return null;

  return (
    <div className="mt-4 rounded-2xl border border-[#334155] overflow-hidden bg-[#1E293B]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#334155]/60 bg-gradient-to-r from-[#1E293B] to-[#0F172A]">
        <Trophy size={16} className="text-[#EAB308]" />
        <h3 className="text-[#F1F5F9] font-bold text-sm">Votação da Partida</h3>
        {summary && (
          <span className="ml-auto text-[#64748B] text-xs">
            {summary.total_voters} voto{summary.total_voters !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="px-4 py-4 space-y-5">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-4 bg-[#334155]/50 rounded-full animate-pulse"
                style={{ width: `${70 - i * 15}%` }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Best player picker */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Star size={14} className="text-[#EAB308]" />
                <p className="text-[#EAB308] text-xs font-bold uppercase tracking-wide">
                  Melhor da Pelada
                </p>
              </div>
              <PlayerPicker
                players={players}
                selected={bestPick}
                onSelect={setBestPick}
                accentColor="#EAB308"
                excludeId={worstPick}
              />
            </div>

            {/* Worst player picker */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ThumbsDown size={14} className="text-[#EF4444]" />
                <p className="text-[#EF4444] text-xs font-bold uppercase tracking-wide">
                  Pior da Pelada
                </p>
              </div>
              <PlayerPicker
                players={players}
                selected={worstPick}
                onSelect={setWorstPick}
                accentColor="#EF4444"
                excludeId={bestPick}
              />
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-[#EF4444] text-xs"
                >
                  <AlertCircle size={13} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={submitting || (!bestPick && !worstPick)}
              onClick={handleSubmit}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border transition-all min-h-[48px] ${
                success
                  ? "bg-[#22C55E]/20 border-[#22C55E]/40 text-[#22C55E]"
                  : !bestPick && !worstPick
                  ? "bg-[#1E293B] border-[#334155] text-[#475569] cursor-not-allowed"
                  : hasVoted
                  ? "bg-[#1D4ED8]/20 border-[#1D4ED8]/40 text-[#3B82F6] hover:bg-[#1D4ED8]/30"
                  : "bg-[#EAB308]/20 border-[#EAB308]/40 text-[#EAB308] hover:bg-[#EAB308]/30"
              }`}
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : success ? (
                <>
                  <Check size={15} />
                  Voto registrado!
                </>
              ) : hasVoted ? (
                <>
                  <Check size={15} />
                  Atualizar voto
                </>
              ) : (
                <>
                  <Flame size={15} />
                  Enviar voto
                </>
              )}
            </motion.button>

            {/* Results */}
            {summary && summary.total_voters > 0 && (
              <div className="space-y-4 pt-2 border-t border-[#334155]/60">
                <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wide">
                  Resultado parcial
                </p>

                {summary.best.length > 0 && (
                  <div>
                    <p className="text-[#EAB308] text-xs font-bold flex items-center gap-1 mb-2">
                      <Star size={11} /> Melhor jogador
                    </p>
                    <div className="space-y-2">
                      {summary.best.slice(0, 3).map((r) => (
                        <VoteBar key={r.player_id} result={r} color="#EAB308" />
                      ))}
                    </div>
                  </div>
                )}

                {summary.worst.length > 0 && (
                  <div>
                    <p className="text-[#EF4444] text-xs font-bold flex items-center gap-1 mb-2">
                      <ThumbsDown size={11} /> Pior jogador
                    </p>
                    <div className="space-y-2">
                      {summary.worst.slice(0, 3).map((r) => (
                        <VoteBar key={r.player_id} result={r} color="#EF4444" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

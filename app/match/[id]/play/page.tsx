"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Undo2,
  Flag,
  Clock,
  ChevronDown,
  Check,
  X,
  Trophy,
  Zap,
  ArrowLeftRight,
  Pause,
  Play,
  ChevronRight,
  Shuffle,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  getMatchById,
  startMatch,
  registerGoal,
  undoLastGoal,
  finishMatch,
  getMatchEvents,
  getLiveMatchPlayers,
  performSubstitution,
  pauseTimer,
  resumeTimer,
  createNextMatch,
  MatchWithTeams,
  Team,
  MatchEvent,
  LivePlayer,
  Match,
  addPlayerToQueue,
  removeFromQueue,
} from "@/services/matchService";
import { usePlayers } from "@/hooks/usePlayers";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import SkeletonCard from "@/components/ui/SkeletonCard";
import { formatTime } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamWithPlayers = MatchWithTeams["teams"][0];

interface GoalModalState {
  open: boolean;
  team: TeamWithPlayers | null;
  step: "scorer" | "assist";
  scorerId: string | null;
  scorerName: string | null;
  /** current active players for this team (post-substitution) */
  activePlayers: { player_id: string; player_name: string }[];
}

interface SubModalState {
  open: boolean;
  team: TeamWithPlayers | null;
  step: "out" | "in";
  outPlayer: LivePlayer | null;
}

interface NextMatchModalState {
  open: boolean;
}

interface AddQueueModalState {
  open: boolean;
}

// ─── Realtime Score — kept in sync via Supabase channel ───────────────────────

interface LiveScores {
  [teamId: string]: number;
}

// ─── Goal Flash animation ─────────────────────────────────────────────────────

function GoalFlash({ teamColor }: { teamColor: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.2, 1.1, 1.1] }}
      transition={{ duration: 1.4, times: [0, 0.2, 0.7, 1] }}
      className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"
    >
      <div
        className="text-[7rem] leading-none"
        style={{ filter: "drop-shadow(0 0 40px " + teamColor + ")" }}
      >
        ⚽
      </div>
    </motion.div>
  );
}

// ─── Synced Timer ─────────────────────────────────────────────────────────────
// Computes elapsed using server-side timer fields so all clients stay in sync.

function useSyncedTimer(match: MatchWithTeams | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!match || match.status !== "in_progress") return;

    function compute() {
      if (!match) return 0;
      const offset = match.timer_offset_seconds ?? 0;
      if (match.timer_paused) return offset;
      if (!match.timer_started_at) return offset;
      const sinceStart = Math.floor(
        (Date.now() - new Date(match.timer_started_at).getTime()) / 1000
      );
      return offset + sinceStart;
    }

    setElapsed(compute());

    // If paused, no need for interval
    if (match.timer_paused) return;

    const interval = setInterval(() => setElapsed(compute()), 1000);
    return () => clearInterval(interval);
  }, [
    match?.status,
    match?.timer_started_at,
    match?.timer_paused,
    match?.timer_offset_seconds,
  ]);

  return elapsed;
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────

function Scoreboard({
  teams,
  scores,
  elapsed,
  status,
  isCreator,
  isPaused,
  onPause,
  onResume,
}: {
  teams: TeamWithPlayers[];
  scores: LiveScores;
  elapsed: number;
  status: string;
  isCreator: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
}) {
  const teamA = teams.find((t) => t.name === "Time A") ?? teams[0];
  const teamB = teams.find((t) => t.name === "Time B") ?? teams[1];

  if (!teamA || !teamB) return null;

  const scoreA = scores[teamA.id] ?? 0;
  const scoreB = scores[teamB.id] ?? 0;

  return (
    <div
      className="relative rounded-3xl overflow-hidden px-4 pt-5 pb-6 mb-2"
      style={{
        background: "linear-gradient(160deg, #1E293B 0%, #0F172A 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Decorative glow spots */}
      <div
        className="absolute top-0 left-0 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: teamA.color }}
      />
      <div
        className="absolute bottom-0 right-0 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: teamB.color }}
      />

      {/* Timer */}
      <div className="flex justify-center items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-[#0F172A]/80 border border-[#334155] rounded-full px-4 py-1.5">
          <Clock size={13} className="text-[#64748B]" />
          <span className="text-[#94A3B8] text-sm font-mono font-bold tracking-wider">
            {status === "waiting"
              ? "AGUARDANDO"
              : status === "finished"
              ? "ENCERRADA"
              : formatTime(elapsed)}
          </span>
          {status === "in_progress" && !isPaused && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
          )}
          {status === "in_progress" && isPaused && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
          )}
        </div>

        {/* Pause / Resume — only for creator */}
        {isCreator && status === "in_progress" && (
          <button
            onClick={isPaused ? onResume : onPause}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border min-h-[36px] transition-colors ${
              isPaused
                ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20"
                : "bg-[#EAB308]/10 border-[#EAB308]/30 text-[#EAB308] hover:bg-[#EAB308]/20"
            }`}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
            {isPaused ? "Retomar" : "Pausar"}
          </button>
        )}
      </div>

      {/* Score */}
      <div className="flex items-center justify-between relative z-10">
        {/* Team A */}
        <div className="flex-1 text-center">
          <p
            className="text-sm font-bold mb-1 uppercase tracking-wide"
            style={{ color: teamA.color }}
          >
            {teamA.name}
          </p>
          <motion.span
            key={scoreA}
            initial={{ scale: 1.4, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="block text-[5.5rem] font-bold font-display leading-none"
            style={{ color: "#F1F5F9" }}
          >
            {scoreA}
          </motion.span>
        </div>

        {/* VS divider */}
        <div className="flex flex-col items-center px-3">
          <div className="w-px h-12 bg-[#334155]" />
          <span className="text-[#475569] text-xs font-display my-1">VS</span>
          <div className="w-px h-12 bg-[#334155]" />
        </div>

        {/* Team B */}
        <div className="flex-1 text-center">
          <p
            className="text-sm font-bold mb-1 uppercase tracking-wide"
            style={{ color: teamB.color }}
          >
            {teamB.name}
          </p>
          <motion.span
            key={scoreB}
            initial={{ scale: 1.4, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="block text-[5.5rem] font-bold font-display leading-none"
            style={{ color: "#F1F5F9" }}
          >
            {scoreB}
          </motion.span>
        </div>
      </div>
    </div>
  );
}

// ─── Goal Button ──────────────────────────────────────────────────────────────

function GoalButton({
  team,
  score,
  onGoal,
  onUndo,
  disabled,
}: {
  team: TeamWithPlayers;
  score: number;
  onGoal: (team: TeamWithPlayers) => void;
  onUndo: (team: TeamWithPlayers) => void;
  disabled: boolean;
}) {
  const isBlue = team.color === "#1D4ED8";

  return (
    <div className="flex flex-col gap-2">
      <motion.button
        whileTap={{ scale: 0.94 }}
        disabled={disabled}
        onClick={() => onGoal(team)}
        className="w-full rounded-2xl py-5 flex flex-col items-center justify-center gap-1 font-bold transition-all active:brightness-90 disabled:opacity-40"
        style={{
          background: isBlue
            ? "linear-gradient(135deg, #1D4ED8, #1E40AF)"
            : "linear-gradient(135deg, #DC2626, #B91C1C)",
          boxShadow: isBlue
            ? "0 4px 20px rgba(29,78,216,0.45)"
            : "0 4px 20px rgba(239,68,68,0.45)",
          minHeight: "88px",
        }}
      >
        <span className="text-3xl">⚽</span>
        <span className="text-white text-base font-display tracking-wide">
          + GOL {team.name.toUpperCase()}
        </span>
      </motion.button>

      {/* Undo button */}
      <button
        onClick={() => onUndo(team)}
        disabled={disabled || score === 0}
        className="w-full flex items-center justify-center gap-2 bg-[#1E293B] border border-[#334155] text-[#64748B] hover:text-[#94A3B8] rounded-xl py-2.5 text-sm font-medium transition-all min-h-[44px] disabled:opacity-30"
      >
        <Undo2 size={15} />
        Desfazer gol
      </button>
    </div>
  );
}

// ─── Goal Modal (scorer + optional assist) ────────────────────────────────────
// Uses activePlayers (current state post-substitution) instead of static team.players

function GoalModal({
  modal,
  onClose,
  onConfirm,
}: {
  modal: GoalModalState;
  onClose: () => void;
  onConfirm: (scorerId: string | null, assistId: string | null) => void;
}) {
  const [assistId, setAssistId] = useState<string | null>(null);
  const [scorerId, setScorerId] = useState<string | null>(modal.scorerId);
  const [step, setStep] = useState<"scorer" | "assist">(modal.step);

  const team = modal.team!;
  const isBlue = team.color === "#1D4ED8";

  // Use activePlayers passed from parent (reflects substitutions)
  const playersInTeam = modal.activePlayers;
  const availableForAssist = playersInTeam.filter(
    (p) => p.player_id !== scorerId
  );

  function handleScorer(pid: string | null) {
    setScorerId(pid);
    setStep("assist");
  }

  function handleAssist(pid: string | null) {
    onConfirm(scorerId, pid);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 38 }}
        className="w-full max-w-md mx-auto bg-[#1E293B] rounded-t-3xl border-t border-[#334155] overflow-hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-[#334155] rounded-full mx-auto mt-4 mb-1" />

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-[#334155]/60"
          style={{
            background: isBlue
              ? "rgba(29,78,216,0.15)"
              : "rgba(239,68,68,0.15)",
          }}
        >
          <div>
            <p className="text-xs text-[#64748B] font-medium">
              Gol do {team.name} ⚽
            </p>
            <h3 className="text-[#F1F5F9] font-bold text-lg font-display">
              {step === "scorer" ? "Quem marcou?" : "Quem deu a assistência?"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F1F5F9] min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Player list */}
        <div className="max-h-[55vh] overflow-y-auto px-4 py-3 space-y-2">
          {/* "Sem assistência" option for assist step */}
          {step === "assist" && (
            <button
              onClick={() => handleAssist(null)}
              className="w-full flex items-center gap-3 bg-[#0F172A] border border-[#334155] hover:border-[#475569] rounded-2xl px-4 py-3 min-h-[60px] text-left transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#334155] flex items-center justify-center shrink-0">
                <Zap size={18} className="text-[#64748B]" />
              </div>
              <span className="text-[#94A3B8] font-semibold">
                Sem assistência / Pular
              </span>
            </button>
          )}

          {/* "Não sei quem marcou" for scorer step */}
          {step === "scorer" && (
            <button
              onClick={() => handleScorer(null)}
              className="w-full flex items-center gap-3 bg-[#0F172A] border border-[#334155] hover:border-[#475569] rounded-2xl px-4 py-3 min-h-[60px] text-left transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#334155] flex items-center justify-center shrink-0">
                <Zap size={18} className="text-[#64748B]" />
              </div>
              <span className="text-[#94A3B8] font-semibold">
                Não sei / Pular
              </span>
            </button>
          )}

          {(step === "scorer" ? playersInTeam : availableForAssist).map(
            (p) => {
              const initials = p.player_name
                .split(" ")
                .slice(0, 2)
                .map((w: string) => w[0])
                .join("")
                .toUpperCase();
              const isSelected =
                step === "assist"
                  ? assistId === p.player_id
                  : scorerId === p.player_id;

              return (
                <button
                  key={p.player_id}
                  onClick={() =>
                    step === "scorer"
                      ? handleScorer(p.player_id)
                      : handleAssist(p.player_id)
                  }
                  className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 min-h-[60px] text-left transition-all border ${
                    isSelected
                      ? isBlue
                        ? "bg-[#1D4ED8]/20 border-[#1D4ED8]/60"
                        : "bg-[#EF4444]/20 border-[#EF4444]/60"
                      : "bg-[#0F172A] border-[#334155] hover:border-[#475569]"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: team.color }}
                  >
                    {initials}
                  </div>
                  <span className="text-[#F1F5F9] font-semibold flex-1 truncate">
                    {p.player_name}
                  </span>
                  {isSelected && (
                    <Check size={18} className="text-[#22C55E] shrink-0" />
                  )}
                </button>
              );
            }
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Substitution Modal ───────────────────────────────────────────────────────

function SubstitutionModal({
  modal,
  liveByTeam,
  reserves,
  onClose,
  onConfirm,
}: {
  modal: SubModalState;
  liveByTeam: LivePlayer[];
  reserves: LivePlayer[];
  onClose: () => void;
  onConfirm: (outPlayerId: string, inPlayerId: string) => void;
}) {
  const [outPlayer, setOutPlayer] = useState<LivePlayer | null>(modal.outPlayer);
  const [step, setStep] = useState<"out" | "in">(modal.step);
  const team = modal.team!;
  const isBlue = team.color === "#1D4ED8";

  const accentBg = isBlue ? "rgba(29,78,216,0.15)" : "rgba(239,68,68,0.15)";
  const selectedBorder = isBlue ? "bg-[#1D4ED8]/20 border-[#1D4ED8]/60" : "bg-[#EF4444]/20 border-[#EF4444]/60";

  function handleSelectOut(player: LivePlayer) {
    setOutPlayer(player);
    setStep("in");
  }

  function handleSelectIn(player: LivePlayer) {
    if (!outPlayer) return;
    onConfirm(outPlayer.player_id, player.player_id);
  }

  const listToShow = step === "out" ? liveByTeam : reserves;
  const hasOptions = listToShow.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 38 }}
        className="w-full max-w-md mx-auto bg-[#1E293B] rounded-t-3xl border-t border-[#334155] overflow-hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-[#334155] rounded-full mx-auto mt-4 mb-1" />

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-[#334155]/60"
          style={{ background: accentBg }}
        >
          <div>
            <p className="text-xs text-[#64748B] font-medium">
              Substituição — {team.name} 🔄
            </p>
            <h3 className="text-[#F1F5F9] font-bold text-lg font-display">
              {step === "out" ? "Quem sai?" : "Quem entra?"}
            </h3>
            {step === "in" && outPlayer && (
              <p className="text-[#64748B] text-xs mt-0.5">
                Saindo: <span className="text-[#94A3B8]">{outPlayer.player_name}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F1F5F9] min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-5 pt-3">
          {(["out", "in"] as const).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                step === s || (s === "out" && step === "in")
                  ? isBlue ? "bg-[#1D4ED8]" : "bg-[#EF4444]"
                  : "bg-[#334155]"
              }`}
            />
          ))}
        </div>

        {/* Player list */}
        <div className="max-h-[50vh] overflow-y-auto px-4 py-3 space-y-2">
          {!hasOptions && (
            <div className="text-center py-8">
              <p className="text-[#64748B] text-sm">
                {step === "out"
                  ? "Nenhum jogador em campo neste time."
                  : "Não há jogadores na fila de próxima."}
              </p>
            </div>
          )}
          {listToShow.map((p) => {
            const initials = p.player_name
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase();
            const isSelected = step === "out"
              ? outPlayer?.player_id === p.player_id
              : false;

            return (
              <button
                key={p.player_id}
                onClick={() =>
                  step === "out" ? handleSelectOut(p) : handleSelectIn(p)
                }
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 min-h-[60px] text-left transition-all border ${
                  isSelected
                    ? selectedBorder
                    : "bg-[#0F172A] border-[#334155] hover:border-[#475569]"
                }`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{
                    background: step === "out" ? team.color : "#475569",
                  }}
                >
                  {initials}
                </div>
                <span className="text-[#F1F5F9] font-semibold flex-1 truncate">
                  {p.player_name}
                </span>
                {step === "in" && (
                  <ArrowLeftRight size={16} className="text-[#64748B] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Add Queue Modal ──────────────────────────────────────────────────────────

function AddQueueModal({
  onClose,
  onAddExisting,
  onCreateNew,
  livePlayersIds,
}: {
  onClose: () => void;
  onAddExisting: (playerId: string) => Promise<{ error: string | null }>;
  onCreateNew: (name: string) => Promise<{ error: string | null }>;
  livePlayersIds: Set<string>;
}) {
  const { permanentPlayers, casualPlayers, loading } = usePlayers();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const { showToast } = useToast();

  const allPlayers = [...permanentPlayers, ...casualPlayers];
  const availablePlayers = allPlayers.filter(
    (p) => !livePlayersIds.has(p.id)
  );

  const filtered = search
    ? availablePlayers.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    : availablePlayers;

  const isExactMatch = allPlayers.some(
    (p) => p.name.toLowerCase() === search.toLowerCase().trim()
  );

  async function handleAddExisting(p: { id: string; name: string }) {
    setAdding(true);
    const { error } = await onAddExisting(p.id);
    setAdding(false);
    if (error) {
      showToast(error, "error");
    } else {
      showToast(`${p.name} entrou na fila!`, "success");
      onClose();
    }
  }

  async function handleCreateNew() {
    const trimmed = search.trim();
    if (!trimmed) return;
    
    // First check if a player with this name already exists in the user's list
    // but maybe they are already in the match?
    const existing = allPlayers.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      if (livePlayersIds.has(existing.id)) {
        showToast("Este jogador já está na partida ou na fila.", "error");
        return;
      }
      // Re-use existing player
      handleAddExisting(existing);
      return;
    }

    setAdding(true);
    const { error } = await onCreateNew(trimmed);
    setAdding(false);
    if (error) {
      showToast(error, "error");
    } else {
      showToast(`${trimmed} criado e adicionado à fila!`, "success");
      onClose();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 38 }}
        className="w-full max-w-md mx-auto bg-[#1E293B] rounded-t-3xl border-t border-[#334155] overflow-hidden flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", maxHeight: "85vh" }}
      >
        <div className="w-10 h-1 bg-[#334155] rounded-full mx-auto mt-4 mb-1 shrink-0" />

        <div className="px-5 py-3 border-b border-[#334155]/60 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs text-[#64748B] font-medium">Time de Próxima 🔜</p>
            <h3 className="text-[#F1F5F9] font-bold text-lg font-display">
              Adicionar Jogador
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F1F5F9] min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 shrink-0">
          <input
            type="text"
            placeholder="Buscar ou digitar novo nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {search.trim() && !isExactMatch && (
            <button
              disabled={adding}
              onClick={handleCreateNew}
              className="w-full flex items-center gap-3 bg-[#1D4ED8]/10 border border-[#1D4ED8]/30 hover:bg-[#1D4ED8]/20 rounded-2xl px-4 py-3 text-left transition-all disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-[#1D4ED8] flex items-center justify-center text-white font-bold shrink-0">
                +
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#3B82F6] font-semibold text-sm">Criar e Adicionar</p>
                <p className="text-[#F1F5F9] font-bold truncate">"{search.trim()}"</p>
              </div>
            </button>
          )}

          {loading ? (
            <div className="text-center py-6 text-[#64748B] text-sm">Carregando...</div>
          ) : filtered.length === 0 && !search.trim() ? (
            <div className="text-center py-6 text-[#64748B] text-sm">
              Todos os seus jogadores já estão na partida.
            </div>
          ) : (
            filtered.map((p) => {
              const initials = p.name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase();
              return (
                <button
                  key={p.id}
                  disabled={adding}
                  onClick={() => handleAddExisting(p)}
                  className="w-full flex items-center gap-3 bg-[#0F172A] border border-[#334155] hover:border-[#475569] rounded-2xl px-4 py-3 min-h-[60px] text-left transition-all disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#334155] flex items-center justify-center text-[#94A3B8] font-bold text-sm shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F1F5F9] font-semibold truncate">{p.name}</p>
                    <p className="text-[#64748B] text-xs">
                      {p.type === "permanent" ? "Fixo" : "Avulso"}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-[#475569]" />
                </button>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Event Feed ───────────────────────────────────────────────────────────────

function EventFeed({
  events,
  teams,
}: {
  events: MatchEvent[];
  teams: TeamWithPlayers[];
}) {
  const goals = events.filter((e) => e.event_type === "goal");
  const subs = events.filter((e) => e.event_type === "substitution");
  if (goals.length === 0 && subs.length === 0) return null;

  const allEvents = [...events]
    .filter((e) => e.event_type === "goal" || e.event_type === "substitution")
    .reverse();

  return (
    <div className="space-y-2">
      <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wide px-1 flex items-center gap-2">
        <Flag size={12} /> Eventos da partida
      </p>
      {allEvents.map((event) => {
        const team = teams.find((t) => t.id === event.team_id);
        const isGoal = event.event_type === "goal";
        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 bg-[#1E293B] border border-[#334155]/60 rounded-2xl px-4 py-3"
          >
            <span className="text-xl">{isGoal ? "⚽" : "🔄"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[#F1F5F9] text-sm font-semibold truncate">
                {isGoal ? (event.player_name ?? "Gol") : `Entrada: ${event.player_name ?? "Jogador"}`}{" "}
                <span className="text-[#64748B] font-normal">
                  — {team?.name}
                </span>
              </p>
              <p className="text-[#475569] text-xs">{event.minute}′</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Finish Confirm Dialog ────────────────────────────────────────────────────

function FinishConfirm({
  teams,
  scores,
  onConfirm,
  onCancel,
  loading,
}: {
  teams: TeamWithPlayers[];
  scores: LiveScores;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const teamA = teams.find((t) => t.name === "Time A") ?? teams[0];
  const teamB = teams.find((t) => t.name === "Time B") ?? teams[1];
  const scoreA = scores[teamA?.id ?? ""] ?? 0;
  const scoreB = scores[teamB?.id ?? ""] ?? 0;

  const winner =
    scoreA > scoreB ? teamA : scoreB > scoreA ? teamB : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{
        backgroundColor: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="w-full max-w-sm bg-[#1E293B] rounded-3xl p-6 border border-[#334155]"
      >
        <div className="w-14 h-14 bg-[#EAB308]/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Trophy size={28} className="text-[#EAB308]" />
        </div>
        <h3 className="text-[#F1F5F9] text-xl font-bold text-center font-display mb-1">
          Encerrar partida?
        </h3>

        {/* Score summary */}
        <div className="flex items-center justify-center gap-4 my-4 bg-[#0F172A] rounded-2xl py-3 px-4">
          <div className="text-center">
            <p className="text-[#3B82F6] text-xs font-semibold mb-1">{teamA?.name}</p>
            <p className="text-[#F1F5F9] text-4xl font-bold font-display">{scoreA}</p>
          </div>
          <span className="text-[#475569] text-2xl font-display">×</span>
          <div className="text-center">
            <p className="text-[#EF4444] text-xs font-semibold mb-1">{teamB?.name}</p>
            <p className="text-[#F1F5F9] text-4xl font-bold font-display">{scoreB}</p>
          </div>
        </div>

        {winner ? (
          <p className="text-center text-[#22C55E] text-sm font-semibold mb-5">
            🏆 Vencedor: {winner.name}
          </p>
        ) : (
          <p className="text-center text-[#EAB308] text-sm font-semibold mb-5">
            🤝 Empate!
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-[#0F172A] border border-[#334155] text-[#94A3B8] rounded-xl py-3 text-sm font-semibold min-h-[48px] hover:border-[#475569] transition-colors"
          >
            Cancelar
          </button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={onConfirm}
            loading={loading}
          >
            Encerrar
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Next Match Modal ─────────────────────────────────────────────────────────

function NextMatchModal({
  teams,
  scores,
  queue,
  matchId,
  teamSize,
  matchName,
  onClose,
  onCreated,
}: {
  teams: TeamWithPlayers[];
  scores: LiveScores;
  queue: LivePlayer[];
  matchId: string;
  teamSize: number;
  matchName: string;
  onClose: () => void;
  onCreated: (newMatchId: string) => void;
}) {
  const { showToast } = useToast();
  const teamA = teams.find((t) => t.name === "Time A") ?? teams[0];
  const teamB = teams.find((t) => t.name === "Time B") ?? teams[1];
  const scoreA = scores[teamA?.id ?? ""] ?? 0;
  const scoreB = scores[teamB?.id ?? ""] ?? 0;
  const isTie = scoreA === scoreB;

  // Auto-determine loser if not a tie
  const autoLoser = !isTie ? (scoreA < scoreB ? teamA : teamB) : null;
  const [drawnLoser, setDrawnLoser] = useState<TeamWithPlayers | null>(autoLoser);
  const [isDrawing, setIsDrawing] = useState(false);
  const [creating, setCreating] = useState(false);

  const nextTeamPlayers = queue.slice(0, teamSize);
  const hasEnoughQueue = nextTeamPlayers.length >= teamSize;
  const winner = teams.find((t) => t.id !== drawnLoser?.id && t.id !== "reserves");

  // How many losers would need to fill the gap
  const queueShortfall = Math.max(0, teamSize - queue.length);
  const loserPlayers = drawnLoser
    ? teams.find((t) => t.id === drawnLoser.id)?.players ?? []
    : [];
  const fillFromLosers = loserPlayers.slice(0, queueShortfall);
  const canFillWithLosers = queueShortfall === 0 || fillFromLosers.length >= queueShortfall;

  async function handleDraw() {
    setIsDrawing(true);
    setDrawnLoser(null);
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const drawn = Math.random() < 0.5 ? teamA : teamB;
    setDrawnLoser(drawn);
    setIsDrawing(false);
  }

  async function handleCreate() {
    if (!drawnLoser) return;
    setCreating(true);
    const { data, error } = await createNextMatch({
      currentMatchId: matchId,
      losingTeamId: drawnLoser.id,
      teamSize,
      matchName: matchName + " (continuação)",
    });
    setCreating(false);
    if (error) {
      showToast(error, "error");
    } else if (data) {
      onCreated(data.id);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        className="w-full max-w-md mx-auto bg-[#1E293B] rounded-t-3xl border-t border-[#334155] overflow-hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-[#334155] rounded-full mx-auto mt-4 mb-1" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-[#334155]/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#64748B] font-medium">Partida encerrada ✅</p>
            <h3 className="text-[#F1F5F9] font-bold text-xl font-display">
              Próxima Partida 🔜
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F1F5F9] min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Placar final */}
          <div className="flex items-center justify-center gap-4 bg-[#0F172A] rounded-2xl py-3 px-4">
            <div className="text-center">
              <p className="text-xs font-semibold mb-1" style={{ color: teamA?.color }}>{teamA?.name}</p>
              <p className="text-[#F1F5F9] text-3xl font-bold font-display">{scoreA}</p>
            </div>
            <span className="text-[#475569] text-xl font-display">×</span>
            <div className="text-center">
              <p className="text-xs font-semibold mb-1" style={{ color: teamB?.color }}>{teamB?.name}</p>
              <p className="text-[#F1F5F9] text-3xl font-bold font-display">{scoreB}</p>
            </div>
          </div>

          {/* Empate — botão de sorteio */}
          {isTie && !drawnLoser && (
            <div className="text-center space-y-3">
              <p className="text-[#EAB308] text-sm font-semibold">🤝 Empate! Quem sai deve ser sorteado.</p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleDraw}
                disabled={isDrawing}
                className="w-full flex items-center justify-center gap-2 bg-[#EAB308]/10 border border-[#EAB308]/30 text-[#EAB308] rounded-2xl py-4 text-base font-bold min-h-[60px] disabled:opacity-50 hover:bg-[#EAB308]/20 transition-colors"
              >
                {isDrawing ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.4, ease: "linear" }}
                    >
                      <Shuffle size={20} />
                    </motion.div>
                    Sorteando...
                  </>
                ) : (
                  <>
                    <Shuffle size={20} />
                    Sortear quem sai 🎲
                  </>
                )}
              </motion.button>
            </div>
          )}

          {/* Resultado do sorteio ou vitória */}
          {drawnLoser && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {/* Time que sai */}
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-2xl px-4 py-3">
                <p className="text-[#EF4444] text-xs font-semibold mb-1 uppercase tracking-wide">
                  ← Sai da partida
                </p>
                <p className="text-[#F1F5F9] font-bold text-base" style={{ color: drawnLoser.color }}>
                  {drawnLoser.name}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {drawnLoser.players.map((p) => (
                    <span key={p.player_id} className="bg-[#EF4444]/20 text-[#FCA5A5] text-xs px-2 py-0.5 rounded-lg font-medium">
                      {p.player_name.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Time de próxima que entra */}
              {hasEnoughQueue ? (
                <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-2xl px-4 py-3">
                  <p className="text-[#22C55E] text-xs font-semibold mb-1 uppercase tracking-wide">
                    → Entra na partida (Time de Próxima)
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {nextTeamPlayers.map((p, i) => (
                      <span key={p.player_id} className="bg-[#22C55E]/20 text-[#86EFAC] text-xs px-2 py-0.5 rounded-lg font-medium">
                        {i + 1}. {p.player_name.split(" ")[0]}
                      </span>
                    ))}
                  </div>
                </div>
              ) : canFillWithLosers ? (
                <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-2xl px-4 py-3 space-y-2">
                  <p className="text-[#22C55E] text-xs font-semibold uppercase tracking-wide">
                    → Entra na partida (fila + perdedores)
                  </p>
                  {/* Queue players */}
                  {queue.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {queue.map((p, i) => (
                        <span key={p.player_id} className="bg-[#22C55E]/20 text-[#86EFAC] text-xs px-2 py-0.5 rounded-lg font-medium">
                          {i + 1}. {p.player_name.split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Fill from losers */}
                  <div>
                    <p className="text-[#EAB308] text-xs font-medium mb-1">⚡ Completando com {fillFromLosers.length} do time que saiu:</p>
                    <div className="flex flex-wrap gap-1">
                      {fillFromLosers.map((p, i) => (
                        <span key={p.player_id} className="bg-[#EAB308]/20 text-[#FDE68A] text-xs px-2 py-0.5 rounded-lg font-medium">
                          {queue.length + i + 1}. {p.player_name.split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-2xl px-4 py-3">
                  <p className="text-[#EF4444] text-sm font-semibold">
                    ⚠️ Não há jogadores suficientes mesmo com o time que perdeu.
                  </p>
                </div>
              )}

              {/* Time vencedor que fica */}
              {winner && (
                <div className="bg-[#1D4ED8]/10 border border-[#1D4ED8]/30 rounded-2xl px-4 py-3">
                  <p className="text-[#3B82F6] text-xs font-semibold mb-1 uppercase tracking-wide">
                    ✓ Fica na partida (vencedor)
                  </p>
                  <p className="text-[#F1F5F9] font-bold text-base" style={{ color: winner.color }}>
                    {winner.name}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {winner.players.map((p) => (
                      <span key={p.player_id} className="bg-[#1D4ED8]/20 text-[#93C5FD] text-xs px-2 py-0.5 rounded-lg font-medium">
                        {p.player_name.split(" ")[0]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-5 py-4 border-t border-[#334155]/60 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-[#0F172A] border border-[#334155] text-[#94A3B8] rounded-xl py-3 text-sm font-semibold min-h-[48px] hover:border-[#475569] transition-colors"
          >
            Fechar
          </button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={!drawnLoser || !canFillWithLosers}
            loading={creating}
            onClick={handleCreate}
          >
            <ChevronRight size={16} />
            Criar próxima
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [match, setMatch] = useState<MatchWithTeams | null>(null);
  const [scores, setScores] = useState<LiveScores>({});
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [livePlayers, setLivePlayers] = useState<LivePlayer[]>([]);
  const [reserves, setReserves] = useState<LivePlayer[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [goalFlash, setGoalFlash] = useState<string | null>(null);
  const [goalModal, setGoalModal] = useState<GoalModalState>({
    open: false,
    team: null,
    step: "scorer",
    scorerId: null,
    scorerName: null,
    activePlayers: [],
  });
  const [subModal, setSubModal] = useState<SubModalState>({
    open: false,
    team: null,
    step: "out",
    outPlayer: null,
  });
  const [nextMatchModal, setNextMatchModal] = useState<NextMatchModalState>({
    open: false,
  });
  const [addQueueModal, setAddQueueModal] = useState<AddQueueModalState>({
    open: false,
  });
  const [removingFromQueue, setRemovingFromQueue] = useState<string | null>(null);

  const { addPlayer } = usePlayers(); // For adding new players on the fly
  const minuteRef = useRef(0);

  // We keep a ref to the matchChannel to send broadcast messages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchChannelRef = useRef<any>(null);

  // Synced timer — all clients compute the same elapsed from server fields
  const elapsed = useSyncedTimer(match);
  const isCreator = !!currentUserId && currentUserId === match?.creator_id;
  const isPaused = match?.timer_paused ?? false;

  // Update minute ref for goal registration
  useEffect(() => {
    minuteRef.current = Math.floor(elapsed / 60) + 1;
  }, [elapsed]);

  // ── Load match data ──
  const loadMatch = useCallback(async () => {
    // Get current user
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data, error } = await getMatchById(id);
    if (error || !data) {
      showToast(error ?? "Partida não encontrada.", "error");
      return;
    }

    setMatch(data);

    // Build initial scores map from teams
    const initialScores: LiveScores = {};
    data.teams.forEach((t) => {
      initialScores[t.id] = t.score;
    });
    setScores(initialScores);

    // Load events
    const { data: evts } = await getMatchEvents(id);
    setEvents(evts);

    // Load live players (active + reserves sorted by queue_position)
    const { active, reserves: res } = await getLiveMatchPlayers(id);
    setLivePlayers(active);
    setReserves(res);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  // ── Supabase Realtime subscription ──
  useEffect(() => {
    if (!match) return;

    const supabase = createClient();

    // Subscribe to teams score changes
    const teamsChannel = supabase
      .channel(`match-teams-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "teams",
          filter: `match_id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as Team;
          setScores((prev) => ({ ...prev, [updated.id]: updated.score }));
        }
      )
      .subscribe();

    // Subscribe to match_events (new goals / substitutions)
    const eventsChannel = supabase
      .channel(`match-events-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_events",
          filter: `match_id=eq.${id}`,
        },
        async () => {
          const { data: evts } = await getMatchEvents(id);
          setEvents(evts);
        }
      )
      .subscribe();

    // Subscribe to match status AND timer changes
    const matchChannel = supabase
      .channel(`match-status-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as Match;
          setMatch((prev) =>
            prev
              ? {
                  ...prev,
                  status: updated.status,
                  started_at: updated.started_at,
                  finished_at: updated.finished_at,
                  timer_started_at: updated.timer_started_at,
                  timer_offset_seconds: updated.timer_offset_seconds,
                  timer_paused: updated.timer_paused,
                }
              : prev
          );
        }
      )
      .on(
        "broadcast",
        { event: "next-match-created" },
        (payload) => {
          // Everyone listening receives this
          if (payload.payload?.newMatchId) {
            showToast("A próxima partida foi criada! Redirecionando...", "info");
            setTimeout(() => {
              router.push(`/match/${payload.payload.newMatchId}/lobby`);
            }, 1500);
          }
        }
      )
      .subscribe();
      
    matchChannelRef.current = matchChannel;

    // Subscribe to match_players changes (substitutions)
    const mpChannel = supabase
      .channel(`match-players-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "match_players",
          filter: `match_id=eq.${id}`,
        },
        async () => {
          const { active, reserves: res } = await getLiveMatchPlayers(id);
          setLivePlayers(active);
          setReserves(res);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(mpChannel);
    };
  }, [id, match?.id]);

  // ── Actions ──

  async function handleStart() {
    setStarting(true);
    const { error } = await startMatch(id);
    setStarting(false);
    if (error) {
      showToast(error, "error");
    } else {
      const now = new Date().toISOString();
      setMatch((prev) =>
        prev
          ? {
              ...prev,
              status: "in_progress",
              started_at: now,
              timer_started_at: now,
              timer_offset_seconds: 0,
              timer_paused: false,
            }
          : prev
      );
    }
  }

  async function handlePause() {
    const { error } = await pauseTimer(id, elapsed);
    if (error) showToast(error, "error");
    else {
      setMatch((prev) =>
        prev ? { ...prev, timer_paused: true, timer_offset_seconds: elapsed } : prev
      );
    }
  }

  async function handleResume() {
    const { error } = await resumeTimer(id);
    if (error) showToast(error, "error");
    else {
      setMatch((prev) =>
        prev
          ? { ...prev, timer_paused: false, timer_started_at: new Date().toISOString() }
          : prev
      );
    }
  }

  function openGoalModal(team: TeamWithPlayers) {
    // Pass current active players for this team (reflects substitutions)
    const activePlayers = livePlayers
      .filter((p) => p.team_id === team.id)
      .map((p) => ({ player_id: p.player_id, player_name: p.player_name }));

    setGoalModal({
      open: true,
      team,
      step: "scorer",
      scorerId: null,
      scorerName: null,
      activePlayers,
    });
  }

  async function handleGoalConfirm(scorerId: string | null, assistId: string | null) {
    setGoalModal((m) => ({ ...m, open: false }));
    if (!goalModal.team) return;

    const team = goalModal.team;
    const { error } = await registerGoal({
      matchId: id,
      teamId: team.id,
      scorerId,
      assistId,
      minute: minuteRef.current,
    });

    if (error) {
      showToast(error, "error");
    } else {
      setScores((prev) => ({ ...prev, [team.id]: (prev[team.id] ?? 0) + 1 }));
      setGoalFlash(team.color);
      setTimeout(() => setGoalFlash(null), 1500);
      showToast(`Gol do ${team.name}! ⚽`, "success");
    }
  }

  async function handleUndo(team: TeamWithPlayers) {
    const { error } = await undoLastGoal({ matchId: id, teamId: team.id });
    if (error) {
      showToast(error, "error");
    } else {
      setScores((prev) => ({
        ...prev,
        [team.id]: Math.max(0, (prev[team.id] ?? 0) - 1),
      }));
      showToast("Gol desfeito.", "info");
    }
  }

  function openSubModal(team: TeamWithPlayers) {
    setSubModal({ open: true, team, step: "out", outPlayer: null });
  }

  async function handleSubConfirm(outPlayerId: string, inPlayerId: string) {
    setSubModal((m) => ({ ...m, open: false }));
    if (!subModal.team) return;

    const { error } = await performSubstitution({
      matchId: id,
      teamId: subModal.team.id,
      outPlayerId,
      inPlayerId,
      minute: minuteRef.current,
    });

    if (error) {
      showToast(error, "error");
    } else {
      // Optimistic update — move players between active and reserves
      const teamId = subModal.team.id;
      const outP = livePlayers.find((p) => p.player_id === outPlayerId);
      const inP = reserves.find((p) => p.player_id === inPlayerId);

      setLivePlayers((prev) => {
        const next = prev.filter((p) => p.player_id !== outPlayerId);
        if (inP) next.push({ ...inP, team_id: teamId, queue_position: null });
        return next;
      });

      setReserves((prev) => {
        const maxQueuePos = Math.max(0, ...prev.map((p) => p.queue_position ?? 0));
        const next = prev.filter((p) => p.player_id !== inPlayerId);
        if (outP) next.push({ ...outP, team_id: null, queue_position: maxQueuePos + 1 });
        return next;
      });

      showToast("Substituição realizada! 🔄", "success");
    }
  }

  async function handleFinish() {
    setFinishing(true);
    const { error } = await finishMatch(id);
    setFinishing(false);
    if (error) {
      showToast(error, "error");
    } else {
      setShowFinishConfirm(false);
      setMatch((prev) => prev ? { ...prev, status: "finished" } : prev);
      showToast("Partida encerrada!", "success");
    }
  }

  async function handleNextMatchCreated(newMatchId: string) {
    setNextMatchModal({ open: false });
    
    // Broadcast the event to all clients so they are redirected too
    if (matchChannelRef.current) {
      await matchChannelRef.current.send({
        type: "broadcast",
        event: "next-match-created",
        payload: { newMatchId },
      });
    }

    // Redirect creator
    router.push(`/match/${newMatchId}/lobby`);
  }

  async function handleAddExistingToQueue(playerId: string) {
    const res = await addPlayerToQueue(id, playerId);
    return res;
  }

  async function handleRemoveFromQueue(matchPlayerId: string) {
    setRemovingFromQueue(matchPlayerId);
    const { error } = await removeFromQueue(id, matchPlayerId);
    setRemovingFromQueue(null);
    if (error) {
      showToast(error, "error");
    } else {
      setReserves((prev) => {
        const filtered = prev.filter((r) => r.match_player_id !== matchPlayerId);
        // Re-compact queue_position locally
        return filtered.map((r, i) => ({ ...r, queue_position: i + 1 }));
      });
      showToast("Jogador removido da fila.", "info");
    }
  }

  async function handleCreateNewAndQueue(name: string) {
    const { data: player, error } = await addPlayer({ name, type: "casual" });
    if (error || !player) return { error: error ?? "Erro ao criar jogador" };
    return await addPlayerToQueue(id, player.id);
  }

  const isWaiting = match?.status === "waiting";
  const isLive = match?.status === "in_progress";
  const isFinished = match?.status === "finished";
  const mainTeams = match?.teams.filter((t) => t.id !== "reserves") ?? [];
  const teamSize = mainTeams[0]?.players.length || 5;

  return (
    <>
      <div className="min-h-screen bg-[#0F172A] pb-12">
        {/* Sticky header */}
        <div
          className="sticky top-0 z-20 border-b border-[#334155]/50"
          style={{
            background: "rgba(15, 23, 42, 0.97)",
            backdropFilter: "blur(12px)",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <div className="flex items-center gap-3 px-4 h-14">
            <button
              onClick={() => router.push(`/match/${id}/lobby`)}
              className="text-[#64748B] hover:text-[#F1F5F9] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-[#F1F5F9] font-bold font-display truncate">
                {match?.name ?? "Partida"}
              </h1>
              <p className="text-[#64748B] text-xs flex items-center gap-1.5">
                {isLive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse inline-block" />
                )}
                {isWaiting && "Aguardando início"}
                {isLive && "Ao vivo"}
                {isFinished && "Encerrada"}
              </p>
            </div>

            {isLive && (
              <button
                onClick={() => setShowFinishConfirm(true)}
                className="flex items-center gap-1.5 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-xl px-3 py-1.5 text-xs font-semibold min-h-[36px] hover:bg-[#EF4444]/20 transition-colors"
              >
                <Flag size={13} />
                Encerrar
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">
          {/* Loading */}
          {loading && (
            <>
              <SkeletonCard height="220px" />
              <SkeletonCard height="100px" />
              <SkeletonCard height="100px" />
            </>
          )}

          {!loading && match && (
            <>
              {/* Scoreboard */}
              <Scoreboard
                teams={mainTeams}
                scores={scores}
                elapsed={elapsed}
                status={match.status}
                isCreator={isCreator}
                isPaused={isPaused}
                onPause={handlePause}
                onResume={handleResume}
              />

              {/* Start button — only when waiting */}
              {isWaiting && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Button
                    variant="primary"
                    className="w-full text-base"
                    loading={starting}
                    onClick={handleStart}
                  >
                    <ChevronDown size={18} />
                    Iniciar Partida Agora
                  </Button>
                </motion.div>
              )}

              {/* Goal buttons — only when live */}
              {isLive && mainTeams.length >= 2 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {mainTeams.slice(0, 2).map((team) => (
                      <GoalButton
                        key={team.id}
                        team={team}
                        score={scores[team.id] ?? 0}
                        onGoal={openGoalModal}
                        onUndo={handleUndo}
                        disabled={isFinished}
                      />
                    ))}
                  </div>

                  {/* Substitution buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {mainTeams.slice(0, 2).map((team) => {
                      const teamActive = livePlayers.filter((p) => p.team_id === team.id);
                      const hasQueue = reserves.length > 0;
                      const isBlue = team.color === "#1D4ED8";
                      return (
                        <button
                          key={team.id}
                          onClick={() => openSubModal(team)}
                          disabled={!hasQueue || teamActive.length === 0}
                          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 border text-sm font-semibold min-h-[44px] transition-all disabled:opacity-30 ${
                            isBlue
                              ? "bg-[#1D4ED8]/10 border-[#1D4ED8]/30 text-[#3B82F6] hover:bg-[#1D4ED8]/20"
                              : "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20"
                          }`}
                        >
                          <ArrowLeftRight size={15} />
                          Sub {team.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Time de Próxima queue */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-[#1E293B] border border-[#334155]/60 rounded-2xl px-4 py-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                        🔜 Time de Próxima
                        <span className="bg-[#334155] text-[#94A3B8] text-xs px-1.5 py-0.5 rounded-full font-mono ml-1">
                          {reserves.length}
                        </span>
                      </p>
                      {/* Creator only button to add player mid-match */}
                      {isCreator && (
                        <button
                          onClick={() => setAddQueueModal({ open: true })}
                          className="text-[#3B82F6] text-xs font-semibold bg-[#1D4ED8]/10 hover:bg-[#1D4ED8]/20 border border-[#1D4ED8]/30 px-2 py-1 rounded-lg transition-colors"
                        >
                          + Adicionar
                        </button>
                      )}
                    </div>
                    
                    {reserves.length > 0 ? (
                      <>
                        <div className="space-y-1.5">
                          {reserves.map((r, i) => (
                            <div
                              key={r.player_id}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-xl ${
                                i < teamSize
                                  ? "bg-[#22C55E]/10 border border-[#22C55E]/25"
                                  : "bg-[#1E293B]"
                              }`}
                            >
                              <span className="text-[#475569] text-xs font-mono w-4 shrink-0">
                                {i + 1}.
                              </span>
                              <span
                                className={`text-sm font-medium flex-1 truncate ${
                                  i < teamSize ? "text-[#86EFAC]" : "text-[#94A3B8]"
                                }`}
                              >
                                {r.player_name}
                              </span>
                              {isCreator && (
                                <button
                                  onClick={() => handleRemoveFromQueue(r.match_player_id)}
                                  disabled={removingFromQueue === r.match_player_id}
                                  className="text-[#475569] hover:text-[#EF4444] transition-colors p-1 shrink-0 disabled:opacity-40"
                                  title="Remover da fila"
                                >
                                  {removingFromQueue === r.match_player_id ? (
                                    <span className="text-xs">...</span>
                                  ) : (
                                    <X size={13} />
                                  )}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-[#475569] text-xs">
                          Os primeiros {teamSize} entram na próxima partida ↑
                        </p>
                      </>
                    ) : (
                      <p className="text-[#64748B] text-xs italic">Nenhum jogador na fila.</p>
                    )}
                  </motion.div>
                </div>
              )}

              {/* Finished — next match section */}
              {isFinished && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-3"
                >
                  <div className="bg-[#EAB308]/10 border border-[#EAB308]/30 rounded-2xl px-5 py-4 text-center">
                    <Trophy size={32} className="text-[#EAB308] mx-auto mb-2" />
                    <p className="text-[#F1F5F9] font-bold text-lg font-display">
                      Partida encerrada!
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="primary"
                      onClick={() => setNextMatchModal({ open: true })}
                    >
                      🔜 Próxima Partida
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => router.push("/dashboard")}
                    >
                      Voltar ao início
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Event feed */}
              <EventFeed events={events} teams={mainTeams} />
            </>
          )}
        </div>
      </div>

      {/* Goal Flash */}
      <AnimatePresence>
        {goalFlash && <GoalFlash key="flash" teamColor={goalFlash} />}
      </AnimatePresence>

      {/* Goal Modal */}
      <AnimatePresence>
        {goalModal.open && goalModal.team && (
          <GoalModal
            modal={goalModal}
            onClose={() => setGoalModal((m) => ({ ...m, open: false }))}
            onConfirm={handleGoalConfirm}
          />
        )}
      </AnimatePresence>

      {/* Substitution Modal */}
      <AnimatePresence>
        {subModal.open && subModal.team && (
          <SubstitutionModal
            modal={subModal}
            liveByTeam={livePlayers.filter((p) => p.team_id === subModal.team!.id)}
            reserves={reserves}
            onClose={() => setSubModal((m) => ({ ...m, open: false }))}
            onConfirm={handleSubConfirm}
          />
        )}
      </AnimatePresence>

      {/* Finish Confirm */}
      <AnimatePresence>
        {showFinishConfirm && match && (
          <FinishConfirm
            teams={mainTeams}
            scores={scores}
            onConfirm={handleFinish}
            onCancel={() => setShowFinishConfirm(false)}
            loading={finishing}
          />
        )}
      </AnimatePresence>

      {/* Next Match Modal */}
      <AnimatePresence>
        {nextMatchModal.open && match && (
          <NextMatchModal
            teams={mainTeams}
            scores={scores}
            queue={reserves}
            matchId={id}
            teamSize={teamSize}
            matchName={match.name}
            onClose={() => setNextMatchModal({ open: false })}
            onCreated={(newMatchId) => {
              setNextMatchModal({ open: false });
              showToast("Nova partida criada! 🚀", "success");
              setTimeout(() => router.push(`/match/${newMatchId}/lobby`), 800);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

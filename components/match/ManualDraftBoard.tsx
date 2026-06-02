"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Check, Users, Layout, ArrowLeft } from "lucide-react";
import { Player } from "@/services/playerService";
import Button from "@/components/ui/Button";

// ─── Team Presets ─────────────────────────────────────────────────────────────

const TEAM_PRESETS = [
  { name: "Time A", color: "#1D4ED8" },
  { name: "Time B", color: "#EF4444" },
  { name: "Time C", color: "#22C55E" },
  { name: "Time D", color: "#EAB308" },
  { name: "Time E", color: "#A855F7" },
  { name: "Time F", color: "#F97316" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftTeam {
  id: string;
  name: string;
  color: string;
}

interface ManualDraftBoardProps {
  players: Player[];
  teamSize: number;
  matchName: string;
  onConfirm: (
    teams: { name: string; color: string; playerIds: string[] }[],
    queueIds: string[]
  ) => Promise<void>;
  onCancel: () => void;
}

function makeTeamId() {
  return "team-" + Math.random().toString(36).slice(2, 8);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManualDraftBoard({
  players,
  teamSize,
  onConfirm,
  onCancel,
}: ManualDraftBoardProps) {
  // Map: playerId → teamId (null = fila/sem time)
  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    () => Object.fromEntries(players.map((p) => [p.id, null]))
  );

  const [teams, setTeams] = useState<DraftTeam[]>([
    { id: makeTeamId(), ...TEAM_PRESETS[0] },
    { id: makeTeamId(), ...TEAM_PRESETS[1] },
  ]);

  const [confirming, setConfirming] = useState(false);
  // Active tab: "players" or "teams"
  const [activeTab, setActiveTab] = useState<"players" | "teams">("players");

  // ── Assign / unassign a player ──
  function assign(playerId: string, teamId: string | null) {
    setAssignments((prev) => {
      // If already on this team, remove (toggle off)
      if (prev[playerId] === teamId) {
        return { ...prev, [playerId]: null };
      }
      return { ...prev, [playerId]: teamId };
    });
  }

  // ── Team management ──
  function addTeam() {
    if (teams.length >= TEAM_PRESETS.length) return;
    const preset = TEAM_PRESETS[teams.length];
    setTeams((prev) => [...prev, { id: makeTeamId(), ...preset }]);
  }

  function removeTeam(teamId: string) {
    // Unassign all players from this team
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((pid) => {
        if (next[pid] === teamId) next[pid] = null;
      });
      return next;
    });
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  }

  function clearTeam(teamId: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((pid) => {
        if (next[pid] === teamId) next[pid] = null;
      });
      return next;
    });
  }

  // ── Derived state ──
  const teamPlayers = (teamId: string) =>
    players.filter((p) => assignments[p.id] === teamId);

  const poolPlayers = players.filter((p) => assignments[p.id] === null);

  const completedTeams = teams.filter(
    (t) => teamPlayers(t.id).length === teamSize
  );
  const canConfirm = completedTeams.length >= 2 && !confirming;

  // ── Confirm ──
  async function handleConfirm() {
    if (!canConfirm) return;
    setConfirming(true);

    const teamOutputs = completedTeams.map((t) => ({
      name: t.name,
      color: t.color,
      playerIds: teamPlayers(t.id).map((p) => p.id),
    }));

    // Players not in a complete team go to queue
    const completedTeamIds = new Set(completedTeams.map((t) => t.id));
    const queueIds = players
      .filter(
        (p) =>
          assignments[p.id] === null ||
          !completedTeamIds.has(assignments[p.id]!)
      )
      .map((p) => p.id);

    await onConfirm(teamOutputs, queueIds);
    setConfirming(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#64748B] text-xs font-medium">Modo Manual</p>
          <h3 className="text-[#F1F5F9] font-bold text-base font-display">
            Organize os Times
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-[#64748B] hover:text-[#F1F5F9] transition-colors p-2 -mr-2"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tab Toggle */}
      <div className="flex bg-[#0F172A] rounded-2xl p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("players")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "players"
              ? "bg-[#1E293B] text-[#F1F5F9] shadow-sm"
              : "text-[#475569] hover:text-[#94A3B8]"
          }`}
        >
          <Users size={14} />
          Jogadores
          <span className="text-xs font-mono bg-[#334155]/60 px-1.5 py-0.5 rounded-full">
            {poolPlayers.length} na fila
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("teams")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "teams"
              ? "bg-[#1E293B] text-[#F1F5F9] shadow-sm"
              : "text-[#475569] hover:text-[#94A3B8]"
          }`}
        >
          <Layout size={14} />
          Times
          <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${
            completedTeams.length >= 2
              ? "bg-[#22C55E]/20 text-[#22C55E]"
              : "bg-[#334155]/60 text-[#94A3B8]"
          }`}>
            {completedTeams.length}/{teams.length} ✓
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">

        {/* ── PLAYERS TAB ── */}
        {activeTab === "players" && (
          <motion.div
            key="players"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {/* Legend */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#475569] text-xs">Toque no time para escalar:</span>
              {teams.map((t) => (
                <span
                  key={t.id}
                  className="text-xs font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: t.color + "30", color: t.color }}
                >
                  {t.name}
                </span>
              ))}
            </div>

            {/* Player list */}
            <div className="space-y-1.5">
              {players.map((player) => {
                const assignedTeamId = assignments[player.id];
                const assignedTeam = teams.find((t) => t.id === assignedTeamId);
                const initials = getInitials(player.name);
                const teamCount = assignedTeam
                  ? teamPlayers(assignedTeam.id).length
                  : 0;
                const isOverfull = assignedTeam ? teamCount > teamSize : false;

                return (
                  <motion.div
                    key={player.id}
                    layout
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all ${
                      assignedTeam
                        ? "bg-[#0F172A]"
                        : "bg-[#1E293B] border-[#334155]/60"
                    }`}
                    style={
                      assignedTeam
                        ? {
                            borderColor: isOverfull
                              ? "#EF4444aa"
                              : assignedTeam.color + "55",
                            background: assignedTeam.color + "10",
                          }
                        : {}
                    }
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 transition-colors"
                      style={{
                        background: assignedTeam ? assignedTeam.color : "#334155",
                      }}
                    >
                      {initials}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold text-sm truncate transition-colors ${
                          assignedTeam ? "text-[#F1F5F9]" : "text-[#94A3B8]"
                        }`}
                      >
                        {player.name}
                      </p>
                      {assignedTeam && (
                        <p
                          className="text-xs font-medium"
                          style={{
                            color: isOverfull ? "#EF4444" : assignedTeam.color + "cc",
                          }}
                        >
                          {isOverfull
                            ? `⚠ ${assignedTeam.name} cheio`
                            : `✓ ${assignedTeam.name} · ${teamCount}/${teamSize}`}
                        </p>
                      )}
                      {!assignedTeam && (
                        <p className="text-[#475569] text-xs">Na fila</p>
                      )}
                    </div>

                    {/* Team buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {teams.map((team) => {
                        const isAssigned = assignedTeamId === team.id;
                        const count = teamPlayers(team.id).length;
                        const full = count >= teamSize && !isAssigned;
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => assign(player.id, isAssigned ? null : team.id)}
                            disabled={full}
                            title={
                              full
                                ? `${team.name} cheio (${count}/${teamSize})`
                                : isAssigned
                                ? `Remover de ${team.name}`
                                : `Colocar no ${team.name}`
                            }
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                              full
                                ? "opacity-25 cursor-not-allowed"
                                : isAssigned
                                ? "scale-110 shadow-lg"
                                : "opacity-60 hover:opacity-100 active:scale-95"
                            }`}
                            style={{
                              background: isAssigned
                                ? team.color
                                : team.color + "30",
                              color: isAssigned ? "white" : team.color,
                              boxShadow: isAssigned
                                ? `0 2px 12px ${team.color}55`
                                : "none",
                            }}
                          >
                            {team.name.replace("Time ", "")}
                          </button>
                        );
                      })}

                      {/* Remove from team (x) only if assigned */}
                      {assignedTeamId && (
                        <button
                          type="button"
                          onClick={() => assign(player.id, null)}
                          className="w-7 h-7 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#475569] hover:text-[#94A3B8] transition-colors"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Add team button */}
            {teams.length < TEAM_PRESETS.length && (
              <button
                type="button"
                onClick={addTeam}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-[#334155] rounded-2xl py-3 text-[#475569] hover:text-[#3B82F6] hover:border-[#3B82F6]/50 text-sm font-semibold transition-all"
              >
                <Plus size={15} />
                Adicionar time
              </button>
            )}
          </motion.div>
        )}

        {/* ── TEAMS TAB ── */}
        {activeTab === "teams" && (
          <motion.div
            key="teams"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {/* Hint */}
            <p className="text-[#475569] text-xs">
              Toque em um jogador para removê-lo do time. Use os botões de time para movê-lo.
            </p>

            {teams.map((team) => {
              const members = teamPlayers(team.id);
              const count = members.length;
              const isComplete = count === teamSize;
              const isOver = count > teamSize;

              return (
                <div
                  key={team.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: isComplete
                      ? team.color + "70"
                      : isOver
                      ? "#EF444470"
                      : "#334155",
                    background: isComplete
                      ? team.color + "08"
                      : "transparent",
                  }}
                >
                  {/* Team header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ background: team.color + "15" }}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: team.color }}
                    />
                    <span
                      className="font-bold text-sm flex-1"
                      style={{ color: team.color }}
                    >
                      {team.name}
                    </span>

                    {/* Count badge */}
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                        isOver
                          ? "bg-[#EF4444]/20 text-[#EF4444]"
                          : isComplete
                          ? "bg-[#22C55E]/20 text-[#22C55E]"
                          : "bg-[#334155] text-[#94A3B8]"
                      }`}
                    >
                      {count}/{teamSize}
                    </span>
                    {isComplete && <Check size={14} style={{ color: team.color }} />}

                    {/* Clear team */}
                    {count > 0 && (
                      <button
                        type="button"
                        onClick={() => clearTeam(team.id)}
                        className="text-xs text-[#475569] hover:text-[#EF4444] transition-colors font-medium ml-1 min-h-[28px] px-1"
                        title="Limpar time"
                      >
                        Limpar
                      </button>
                    )}

                    {/* Remove team (only if > 2 teams) */}
                    {teams.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeTeam(team.id)}
                        className="text-[#475569] hover:text-[#EF4444] transition-colors p-0.5 ml-1"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Members — click to remove */}
                  <div className="px-4 py-2 space-y-1.5">
                    {count === 0 ? (
                      <div className="text-center py-3">
                        <p className="text-[#475569] text-xs italic">
                          Nenhum jogador ainda.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab("players")}
                          className="text-[#3B82F6] text-xs font-semibold flex items-center gap-1 mx-auto mt-1.5 min-h-[32px]"
                        >
                          <ArrowLeft size={12} />
                          Escalar na aba Jogadores
                        </button>
                      </div>
                    ) : (
                      members.map((p, i) => {
                        const initials = getInitials(p.name);
                        return (
                          <motion.div
                            key={p.id}
                            layout
                            className="flex items-center gap-2.5"
                          >
                            <span className="text-[#475569] text-xs w-4 font-mono shrink-0">
                              {i + 1}.
                            </span>
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: team.color }}
                            >
                              {initials}
                            </div>
                            <span
                              className={`text-sm font-medium flex-1 truncate ${
                                i >= teamSize ? "text-[#EF4444]" : "text-[#F1F5F9]"
                              }`}
                            >
                              {p.name}
                            </span>

                            {/* Move to another team */}
                            <div className="flex gap-1 shrink-0">
                              {teams.filter((t) => t.id !== team.id).map((otherTeam) => {
                                const otherCount = teamPlayers(otherTeam.id).length;
                                const otherFull = otherCount >= teamSize;
                                return (
                                  <button
                                    key={otherTeam.id}
                                    type="button"
                                    onClick={() => assign(p.id, otherTeam.id)}
                                    disabled={otherFull}
                                    title={
                                      otherFull
                                        ? `${otherTeam.name} cheio`
                                        : `Mover para ${otherTeam.name}`
                                    }
                                    className="w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center transition-all disabled:opacity-20"
                                    style={{
                                      background: otherTeam.color + "30",
                                      color: otherTeam.color,
                                    }}
                                  >
                                    {otherTeam.name.replace("Time ", "")}
                                  </button>
                                );
                              })}

                              {/* Remove from team (back to queue) */}
                              <button
                                type="button"
                                onClick={() => assign(p.id, null)}
                                className="w-6 h-6 rounded-lg bg-[#334155]/60 flex items-center justify-center text-[#475569] hover:text-[#EF4444] transition-colors"
                                title="Remover do time (volta à fila)"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add team button */}
            {teams.length < TEAM_PRESETS.length && (
              <button
                type="button"
                onClick={addTeam}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-[#334155] rounded-2xl py-3 text-[#475569] hover:text-[#3B82F6] hover:border-[#3B82F6]/50 text-sm font-semibold transition-all"
              >
                <Plus size={15} />
                Adicionar time
              </button>
            )}

            {/* Queue summary */}
            {poolPlayers.length > 0 && (
              <div className="bg-[#0F172A] rounded-2xl border border-[#334155]/60 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={13} className="text-[#64748B]" />
                  <span className="text-[#64748B] text-xs font-semibold uppercase tracking-wide">
                    Fila de espera
                    <span className="ml-1.5 bg-[#334155] text-[#94A3B8] text-xs px-1.5 py-0.5 rounded-full font-mono">
                      {poolPlayers.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("players")}
                    className="ml-auto text-[#3B82F6] text-xs font-semibold hover:text-[#60A5FA]"
                  >
                    Escalar →
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {poolPlayers.map((p) => (
                    <span
                      key={p.id}
                      className="bg-[#1E293B] border border-[#334155]/60 text-[#94A3B8] text-xs px-2.5 py-1 rounded-lg font-medium"
                    >
                      {p.name.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* Status */}
      <AnimatePresence mode="wait">
        {completedTeams.length < 2 ? (
          <motion.p
            key="warn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-[#64748B] text-xs"
          >
            Preencha ao menos 2 times com {teamSize} jogadores cada.
          </motion.p>
        ) : (
          <motion.p
            key="ok"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-[#22C55E] text-xs font-medium"
          >
            ✓ {completedTeams.length} time{completedTeams.length > 1 ? "s" : ""} prontos
            {poolPlayers.length > 0 && ` · ${poolPlayers.length} na fila`}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Confirm */}
      <Button
        type="button"
        variant="primary"
        className="w-full"
        disabled={!canConfirm}
        loading={confirming}
        onClick={handleConfirm}
      >
        <Check size={17} />
        {confirming
          ? "Criando partida..."
          : `Criar Partida Manual · ${completedTeams.length} time${completedTeams.length !== 1 ? "s" : ""}`}
      </Button>
    </motion.div>
  );
}

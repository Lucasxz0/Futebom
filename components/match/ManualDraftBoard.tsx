"use client";

import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Check, GripVertical, Users } from "lucide-react";
import { Player } from "@/services/playerService";
import Button from "@/components/ui/Button";

// ─── Team Colors ──────────────────────────────────────────────────────────────

const TEAM_PRESETS = [
  { name: "Time A", color: "#1D4ED8" },  // Blue
  { name: "Time B", color: "#EF4444" },  // Red
  { name: "Time C", color: "#22C55E" },  // Green
  { name: "Time D", color: "#EAB308" },  // Yellow
  { name: "Time E", color: "#A855F7" },  // Purple
  { name: "Time F", color: "#F97316" },  // Orange
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftTeam {
  id: string; // local draft id
  name: string;
  color: string;
  slots: (string | null)[]; // player IDs or null
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function makeTeamId() {
  return "team-" + Math.random().toString(36).slice(2, 8);
}

// ─── PlayerChip ───────────────────────────────────────────────────────────────

function PlayerChip({
  player,
  color,
  provided,
  isDragging,
  onRemove,
}: {
  player: Player;
  color?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provided?: any;
  isDragging?: boolean;
  onRemove?: () => void;
}) {
  const initials = getInitials(player.name);

  return (
    <div
      ref={provided?.innerRef}
      {...(provided?.draggableProps ?? {})}
      {...(provided?.dragHandleProps ?? {})}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all select-none ${
        isDragging
          ? "shadow-2xl scale-105 z-50 bg-[#1E293B] border-[#475569]"
          : color
          ? "bg-[#0F172A] border-[#334155] hover:border-[#475569]"
          : "bg-[#1E293B] border-[#334155] hover:border-[#475569]"
      }`}
      style={
        isDragging
          ? { boxShadow: `0 8px 32px rgba(0,0,0,0.6)` }
          : {}
      }
    >
      <GripVertical size={14} className="text-[#475569] shrink-0 cursor-grab" />
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ background: color ?? "#334155" }}
      >
        {initials}
      </div>
      <span className="text-[#F1F5F9] text-sm font-medium flex-1 truncate">
        {player.name}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-[#475569] hover:text-[#94A3B8] transition-colors shrink-0 p-0.5"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManualDraftBoard({
  players,
  teamSize,
  matchName,
  onConfirm,
  onCancel,
}: ManualDraftBoardProps) {
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  // Pool = all player IDs not yet assigned to any team
  const [pool, setPool] = useState<string[]>(players.map((p) => p.id));

  // Teams — start with 2
  const [teams, setTeams] = useState<DraftTeam[]>([
    {
      id: makeTeamId(),
      name: TEAM_PRESETS[0].name,
      color: TEAM_PRESETS[0].color,
      slots: Array(teamSize).fill(null),
    },
    {
      id: makeTeamId(),
      name: TEAM_PRESETS[1].name,
      color: TEAM_PRESETS[1].color,
      slots: Array(teamSize).fill(null),
    },
  ]);

  const [confirming, setConfirming] = useState(false);

  // ── Helpers ──

  function addTeam() {
    const idx = Math.min(teams.length, TEAM_PRESETS.length - 1);
    const preset = TEAM_PRESETS[idx] ?? {
      name: `Time ${String.fromCharCode(65 + teams.length)}`,
      color: "#6B7280",
    };
    setTeams((prev) => [
      ...prev,
      {
        id: makeTeamId(),
        name: preset.name,
        color: preset.color,
        slots: Array(teamSize).fill(null),
      },
    ]);
  }

  function removeTeam(teamId: string) {
    setTeams((prev) => {
      const team = prev.find((t) => t.id === teamId);
      if (!team) return prev;
      // Return all assigned players back to pool
      const returnIds = team.slots.filter(Boolean) as string[];
      setPool((p) => [...p, ...returnIds]);
      return prev.filter((t) => t.id !== teamId);
    });
  }

  // Remove player from a team slot back to pool
  function removeFromSlot(teamId: string, slotIdx: number) {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        const pid = t.slots[slotIdx];
        if (!pid) return t;
        setPool((p) => [...p, pid]);
        const newSlots = [...t.slots];
        newSlots[slotIdx] = null;
        return { ...t, slots: newSlots };
      })
    );
  }

  // ── Drag & Drop ──

  function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const playerId = draggableId.replace("player-", "");

    // ── From pool ──
    if (source.droppableId === "pool") {
      if (destination.droppableId === "pool") {
        // Reorder pool
        setPool((prev) => {
          const next = [...prev];
          const [moved] = next.splice(source.index, 1);
          next.splice(destination.index, 0, moved);
          return next;
        });
        return;
      }

      // Drop into a team slot
      const [teamId, slotStr] = destination.droppableId.split("::slot::");
      const slotIdx = parseInt(slotStr, 10);

      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== teamId) return t;
          const currentOccupant = t.slots[slotIdx];
          const newSlots = [...t.slots];
          newSlots[slotIdx] = playerId;

          // If slot was occupied, return that player to pool
          if (currentOccupant) {
            setPool((p) => {
              const filtered = p.filter((id) => id !== playerId);
              return [...filtered, currentOccupant];
            });
          } else {
            setPool((p) => p.filter((id) => id !== playerId));
          }

          return { ...t, slots: newSlots };
        })
      );
      return;
    }

    // ── From a team slot ──
    const [srcTeamId, srcSlotStr] = source.droppableId.split("::slot::");
    const srcSlotIdx = parseInt(srcSlotStr, 10);

    // Drop back to pool
    if (destination.droppableId === "pool") {
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== srcTeamId) return t;
          const newSlots = [...t.slots];
          newSlots[srcSlotIdx] = null;
          return { ...t, slots: newSlots };
        })
      );
      setPool((prev) => {
        const next = prev.filter((id) => id !== playerId);
        next.splice(destination.index, 0, playerId);
        return next;
      });
      return;
    }

    // Drop into another team slot
    const [dstTeamId, dstSlotStr] = destination.droppableId.split("::slot::");
    const dstSlotIdx = parseInt(dstSlotStr, 10);

    setTeams((prev) => {
      const next = prev.map((t) => ({ ...t, slots: [...t.slots] }));
      const srcTeam = next.find((t) => t.id === srcTeamId);
      const dstTeam = next.find((t) => t.id === dstTeamId);
      if (!srcTeam || !dstTeam) return prev;

      const movedPlayer = srcTeam.slots[srcSlotIdx];
      const swappedPlayer = dstTeam.slots[dstSlotIdx];

      srcTeam.slots[srcSlotIdx] = swappedPlayer ?? null;
      dstTeam.slots[dstSlotIdx] = movedPlayer ?? null;

      return next;
    });
  }

  // ── Validation ──

  const completedTeams = teams.filter((t) => t.slots.every((s) => s !== null));
  const canConfirm = completedTeams.length >= 2 && !confirming;

  // ── Confirm ──

  async function handleConfirm() {
    if (!canConfirm) return;
    setConfirming(true);

    const teamOutputs = completedTeams.map((t) => ({
      name: t.name,
      color: t.color,
      playerIds: t.slots.filter(Boolean) as string[],
    }));

    // Incomplete teams go back to queue
    const incompleteSlotIds = teams
      .filter((t) => !t.slots.every((s) => s !== null))
      .flatMap((t) => t.slots.filter(Boolean) as string[]);

    const queueIds = [...pool, ...incompleteSlotIds];

    await onConfirm(teamOutputs, queueIds);
    setConfirming(false);
  }

  // ── Render ──

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="space-y-5"
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
            className="text-[#64748B] hover:text-[#F1F5F9] transition-colors p-2"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pool — all players not yet assigned */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users size={13} className="text-[#64748B]" />
            <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wide">
              Jogadores disponíveis
              <span className="ml-1.5 bg-[#334155] text-[#94A3B8] text-xs px-1.5 py-0.5 rounded-full font-mono">
                {pool.length}
              </span>
            </p>
          </div>

          <Droppable droppableId="pool">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[56px] rounded-2xl border transition-colors p-2 space-y-1.5 ${
                  snapshot.isDraggingOver
                    ? "border-[#1D4ED8]/60 bg-[#1D4ED8]/5"
                    : pool.length === 0
                    ? "border-dashed border-[#22C55E]/50 bg-[#22C55E]/5"
                    : "border-[#334155]/60 bg-[#0F172A]"
                }`}
              >
                {pool.length === 0 && !snapshot.isDraggingOver && (
                  <p className="text-[#22C55E] text-xs text-center py-3 font-medium">
                    ✓ Todos os jogadores foram escalados!
                  </p>
                )}
                {pool.map((pid, index) => {
                  const player = playerMap[pid];
                  if (!player) return null;
                  return (
                    <Draggable
                      key={`player-${pid}`}
                      draggableId={`player-${pid}`}
                      index={index}
                    >
                      {(prov, snap) => (
                        <PlayerChip
                          player={player}
                          provided={prov}
                          isDragging={snap.isDragging}
                        />
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>

        {/* Teams grid — 3 per row */}
        <div>
          <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wide mb-3">
            Times ({teams.length})
          </p>

          <div className="grid grid-cols-1 gap-4">
            {/* Chunk teams in groups of 3 for layout */}
            {Array.from({ length: Math.ceil(teams.length / 3) }, (_, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-3 gap-2">
                {teams.slice(rowIdx * 3, rowIdx * 3 + 3).map((team) => {
                  const filledCount = team.slots.filter(Boolean).length;
                  const isComplete = filledCount === teamSize;

                  return (
                    <div
                      key={team.id}
                      className={`rounded-2xl border transition-colors overflow-hidden ${
                        isComplete
                          ? "border-opacity-60"
                          : "border-[#334155]/60"
                      }`}
                      style={
                        isComplete
                          ? { borderColor: team.color + "66" }
                          : {}
                      }
                    >
                      {/* Team header */}
                      <div
                        className="px-2 py-1.5 flex items-center justify-between"
                        style={{
                          background: team.color + "18",
                          borderBottom: `1px solid ${team.color}30`,
                        }}
                      >
                        <span
                          className="text-xs font-bold truncate"
                          style={{ color: team.color }}
                        >
                          {team.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {isComplete && (
                            <Check size={11} style={{ color: team.color }} />
                          )}
                          {teams.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeTeam(team.id)}
                              className="text-[#475569] hover:text-[#94A3B8] transition-colors p-0.5"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Slots */}
                      <div className="p-1.5 space-y-1 bg-[#0F172A]">
                        {team.slots.map((slotPid, slotIdx) => {
                          const droppableId = `${team.id}::slot::${slotIdx}`;
                          const slotPlayer = slotPid ? playerMap[slotPid] : null;

                          return (
                            <Droppable key={slotIdx} droppableId={droppableId}>
                              {(prov, snap) => (
                                <div
                                  ref={prov.innerRef}
                                  {...prov.droppableProps}
                                  className={`rounded-lg min-h-[36px] transition-colors ${
                                    snap.isDraggingOver
                                      ? "bg-[#1D4ED8]/15 border border-dashed"
                                      : slotPlayer
                                      ? "bg-[#1E293B]"
                                      : "border border-dashed border-[#334155]/40"
                                  }`}
                                  style={
                                    snap.isDraggingOver
                                      ? { borderColor: team.color }
                                      : {}
                                  }
                                >
                                  {slotPlayer ? (
                                    <Draggable
                                      draggableId={`player-${slotPid}`}
                                      index={0}
                                    >
                                      {(playerProv, playerSnap) => (
                                        <div
                                          ref={playerProv.innerRef}
                                          {...playerProv.draggableProps}
                                          {...playerProv.dragHandleProps}
                                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg select-none ${
                                            playerSnap.isDragging
                                              ? "opacity-70"
                                              : ""
                                          }`}
                                        >
                                          <GripVertical
                                            size={10}
                                            className="text-[#475569] shrink-0 cursor-grab"
                                          />
                                          <div
                                            className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                            style={{ background: team.color }}
                                          >
                                            {getInitials(slotPlayer.name)}
                                          </div>
                                          <span className="text-[#F1F5F9] text-xs font-medium flex-1 truncate">
                                            {slotPlayer.name.split(" ")[0]}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeFromSlot(team.id, slotIdx)
                                            }
                                            className="text-[#475569] hover:text-[#94A3B8] shrink-0 p-0.5"
                                          >
                                            <X size={10} />
                                          </button>
                                        </div>
                                      )}
                                    </Draggable>
                                  ) : (
                                    <div className="flex items-center justify-center h-9">
                                      <span className="text-[#334155] text-xs">
                                        {slotIdx + 1}
                                      </span>
                                    </div>
                                  )}
                                  <div style={{ display: "none" }}>
                                    {prov.placeholder}
                                  </div>
                                </div>
                              )}
                            </Droppable>
                          );
                        })}
                      </div>

                      {/* Slot count */}
                      <div
                        className="px-2 py-1 text-center"
                        style={{ background: team.color + "10" }}
                      >
                        <span
                          className="text-xs font-mono"
                          style={{ color: team.color + "cc" }}
                        >
                          {filledCount}/{teamSize}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Add team button */}
          {teams.length < TEAM_PRESETS.length && (
            <button
              type="button"
              onClick={addTeam}
              className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-[#334155] hover:border-[#475569] rounded-2xl py-3 text-[#64748B] hover:text-[#94A3B8] text-sm font-medium transition-all"
            >
              <Plus size={16} />
              Adicionar Time
            </button>
          )}
        </div>

        {/* Status indicator */}
        <AnimatePresence>
          {completedTeams.length < 2 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-[#64748B] text-xs"
            >
              ⚠️ Preencha ao menos 2 times completos para criar a partida.
            </motion.p>
          )}
          {completedTeams.length >= 2 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-[#22C55E] text-xs font-medium"
            >
              ✓ {completedTeams.length} time{completedTeams.length > 1 ? "s" : ""} prontos
              {pool.length > 0 && ` · ${pool.length} na fila`}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Confirm button */}
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
            : `Criar Partida Manual · ${completedTeams.length} times`}
        </Button>
      </motion.div>
    </DragDropContext>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Users,
  UserCheck,
  Zap,
  ShieldCheck,
  Check,
  Swords,
} from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";
import { Player } from "@/services/playerService";
import { createMatch } from "@/services/matchService";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import SkeletonCard from "@/components/ui/SkeletonCard";

// ─── Player Selector Item ─────────────────────────────────────────────────────

function PlayerSelectItem({
  player,
  selected,
  onToggle,
}: {
  player: Player;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const isPermanent = player.type === "permanent";
  const initials = player.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <motion.button
      layout
      type="button"
      onClick={() => onToggle(player.id)}
      whileTap={{ scale: 0.97 }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all min-h-[64px] ${
        selected
          ? "bg-[#1D4ED8]/20 border-[#1D4ED8]/60"
          : "bg-[#1E293B] border-[#334155]/60 hover:border-[#475569]"
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold font-display text-sm transition-colors ${
          selected
            ? "bg-[#1D4ED8] text-white"
            : isPermanent
            ? "bg-[#1D4ED8]/20 text-[#3B82F6]"
            : "bg-[#334155] text-[#94A3B8]"
        }`}
      >
        {selected ? <Check size={16} /> : initials}
      </div>

      {/* Name + type */}
      <div className="flex-1 text-left min-w-0">
        <p
          className={`font-semibold truncate transition-colors ${
            selected ? "text-[#F1F5F9]" : "text-[#94A3B8]"
          }`}
        >
          {player.name}
        </p>
        <span
          className={`text-xs flex items-center gap-1 ${
            isPermanent ? "text-[#3B82F6]" : "text-[#64748B]"
          }`}
        >
          {isPermanent ? (
            <><ShieldCheck size={10} /> Fixo</>
          ) : (
            <><Zap size={10} /> Avulso</>
          )}
        </span>
      </div>

      {/* Checkbox visual */}
      <div
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
          selected
            ? "bg-[#1D4ED8] border-[#1D4ED8]"
            : "border-[#334155]"
        }`}
      >
        {selected && <Check size={13} className="text-white" />}
      </div>
    </motion.button>
  );
}

// ─── Team Size Picker ─────────────────────────────────────────────────────────

function TeamSizePicker({
  value,
  onChange,
  maxPlayers,
}: {
  value: number;
  onChange: (v: number) => void;
  maxPlayers: number;
}) {
  const sizes = [3, 4, 5, 6, 7, 8];

  return (
    <div className="grid grid-cols-6 gap-2">
      {sizes.map((s) => {
        const enough = maxPlayers >= s * 2;
        return (
          <button
            key={s}
            type="button"
            disabled={!enough}
            onClick={() => onChange(s)}
            className={`h-11 rounded-xl border font-bold font-display text-base transition-all ${
              value === s
                ? "bg-[#1D4ED8] border-[#1D4ED8] text-white shadow-lg"
                : enough
                ? "bg-[#0F172A] border-[#334155] text-[#94A3B8] hover:border-[#475569]"
                : "bg-[#0F172A] border-[#1E293B] text-[#334155] cursor-not-allowed"
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewMatchPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { players, permanentPlayers, casualPlayers, loading } = usePlayers();

  const [matchName, setMatchName] = useState("Futebom");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [teamSize, setTeamSize] = useState(5);
  const [creating, setCreating] = useState(false);
  const [showPermanent, setShowPermanent] = useState(true);
  const [showCasual, setShowCasual] = useState(true);
  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-select all permanent players on load
  useEffect(() => {
    if (permanentPlayers.length > 0) {
      setSelectedIds(new Set(permanentPlayers.map((p) => p.id)));
    }
  }, [permanentPlayers.length]);

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(players.map((p) => p.id)));
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  function shuffleSelection() {
    // Keep same count but re-select randomly (useful for casual picks)
    const count = selectedIds.size;
    const shuffled = [...players].sort(() => Math.random() - 0.5).slice(0, count);
    setSelectedIds(new Set(shuffled.map((p) => p.id)));
    showToast("Seleção embaralhada!", "info");
  }

  const selectedCount = selectedIds.size;
  const minRequired = teamSize * 2;
  const canCreate = selectedCount >= minRequired && !creating;
  const shortfall = Math.max(0, minRequired - selectedCount);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;

    setCreating(true);
    const { data, error } = await createMatch({
      name: matchName.trim() || "Futebom",
      playerIds: Array.from(selectedIds),
      teamSize,
    });
    setCreating(false);

    if (error) {
      showToast(error, "error");
      return;
    }

    if (data) {
      router.push(`/match/${data.id}/lobby`);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-10">
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
            onClick={() => router.back()}
            className="text-[#64748B] hover:text-[#F1F5F9] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-[#F1F5F9] text-lg font-bold font-display flex items-center gap-2">
            <Swords size={20} className="text-[#3B82F6]" />
            Nova Partida
          </h1>
        </div>
      </div>

      <form onSubmit={handleCreate} className="px-4 pt-5 space-y-6">

        {/* Match name */}
        <div>
          <label
            htmlFor="match-name"
            className="block text-[#94A3B8] text-sm font-medium mb-2"
          >
            Nome da partida
          </label>
          <input
            ref={nameRef}
            id="match-name"
            type="text"
            value={matchName}
            onChange={(e) => setMatchName(e.target.value)}
            placeholder="Ex: Jogo de quinta"
            maxLength={40}
            className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors text-base"
            style={{ minHeight: "52px" }}
          />
        </div>

        {/* Team size */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[#94A3B8] text-sm font-medium">
              Jogadores por time
            </label>
            <span className="text-[#3B82F6] text-sm font-bold font-display">
              {teamSize}x{teamSize}
            </span>
          </div>
          <TeamSizePicker
            value={teamSize}
            onChange={setTeamSize}
            maxPlayers={players.length}
          />
          <p className="text-[#64748B] text-xs mt-2">
            Mínimo {minRequired} jogadores selecionados para este formato.
          </p>
        </div>

        {/* Player selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-[#94A3B8] text-sm font-medium flex items-center gap-2">
              <Users size={15} />
              Selecionar jogadores
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                  selectedCount >= minRequired
                    ? "bg-[#22C55E]/20 text-[#22C55E]"
                    : "bg-[#EF4444]/20 text-[#EF4444]"
                }`}
              >
                {selectedCount}/{players.length}
              </span>
            </label>
            {!loading && players.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={shuffleSelection}
                  className="text-[#64748B] hover:text-[#3B82F6] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="Embaralhar seleção"
                >
                  <Shuffle size={16} />
                </button>
                <button
                  type="button"
                  onClick={selectedCount === players.length ? clearAll : selectAll}
                  className="text-[#3B82F6] text-xs font-semibold min-h-[36px] px-2"
                >
                  {selectedCount === players.length ? "Limpar" : "Todos"}
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonCard key={i} height="64px" />
              ))}
            </div>
          )}

          {!loading && players.length === 0 && (
            <div className="text-center py-8 bg-[#1E293B] rounded-2xl border border-dashed border-[#334155]">
              <Users size={32} className="text-[#334155] mx-auto mb-2" />
              <p className="text-[#64748B] text-sm">
                Nenhum jogador cadastrado ainda.
              </p>
              <button
                type="button"
                onClick={() => router.push("/players")}
                className="text-[#3B82F6] text-sm font-semibold mt-2 min-h-[36px]"
              >
                Adicionar jogadores →
              </button>
            </div>
          )}

          {/* Permanent players section */}
          {!loading && permanentPlayers.length > 0 && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowPermanent((v) => !v)}
                className="w-full flex items-center gap-2 text-left mb-2 min-h-[36px]"
              >
                <UserCheck size={14} className="text-[#3B82F6]" />
                <span className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide">
                  Fixos
                </span>
                <span className="text-[#64748B] text-xs ml-1">
                  ({permanentPlayers.filter((p) => selectedIds.has(p.id)).length}/
                  {permanentPlayers.length})
                </span>
                <span className="ml-auto text-[#64748B]">
                  {showPermanent ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>
              <AnimatePresence>
                {showPermanent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    {permanentPlayers.map((p) => (
                      <PlayerSelectItem
                        key={p.id}
                        player={p}
                        selected={selectedIds.has(p.id)}
                        onToggle={togglePlayer}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Casual players section */}
          {!loading && casualPlayers.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowCasual((v) => !v)}
                className="w-full flex items-center gap-2 text-left mb-2 min-h-[36px]"
              >
                <Zap size={14} className="text-[#64748B]" />
                <span className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide">
                  Avulsos
                </span>
                <span className="text-[#64748B] text-xs ml-1">
                  ({casualPlayers.filter((p) => selectedIds.has(p.id)).length}/
                  {casualPlayers.length})
                </span>
                <span className="ml-auto text-[#64748B]">
                  {showCasual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>
              <AnimatePresence>
                {showCasual && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    {casualPlayers.map((p) => (
                      <PlayerSelectItem
                        key={p.id}
                        player={p}
                        selected={selectedIds.has(p.id)}
                        onToggle={togglePlayer}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Warning if not enough players */}
        <AnimatePresence>
          {shortfall > 0 && selectedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2 bg-[#EAB308]/10 border border-[#EAB308]/30 rounded-xl px-4 py-3"
            >
              <span className="text-[#EAB308] text-sm">
                ⚠️ Selecione mais {shortfall} jogador{shortfall > 1 ? "es" : ""} para
                um {teamSize}x{teamSize}.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create button */}
        <div className="pt-2 pb-6">
          <Button
            type="submit"
            variant="primary"
            className="w-full text-base"
            loading={creating}
            disabled={!canCreate}
          >
            <Swords size={18} />
            {creating ? "Sorteando times..." : "Criar Partida e Sortear Times"}
          </Button>
          {!canCreate && selectedCount === 0 && !loading && players.length > 0 && (
            <p className="text-center text-[#64748B] text-xs mt-2">
              Selecione pelo menos {minRequired} jogadores para um {teamSize}x{teamSize}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

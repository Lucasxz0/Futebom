"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trophy,
  Clock,
  ChevronRight,
  Calendar,
  Swords,
  Trash2,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMatchHistory, deleteMatches, MatchSummary } from "@/services/historyService";
import SkeletonCard from "@/components/ui/SkeletonCard";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function formatDuration(started: string | null, finished: string | null): string {
  if (!started || !finished) return "";
  const mins = Math.round(
    (new Date(finished).getTime() - new Date(started).getTime()) / 60000
  );
  return `${mins} min`;
}

function getWinner(teams: MatchSummary["teams"]) {
  if (teams.length < 2) return null;
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  if (sorted[0].score === sorted[1].score) return null;
  return sorted[0];
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  count,
  onConfirm,
  onCancel,
  loading,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 35 }}
        className="w-full max-w-sm bg-[#1E293B] rounded-3xl p-6 border border-[#334155]"
      >
        <div className="w-14 h-14 bg-[#EF4444]/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Trash2 size={28} className="text-[#EF4444]" />
        </div>
        <h3 className="text-[#F1F5F9] text-lg font-bold text-center mb-2 font-display">
          Apagar {count} partida{count !== 1 ? "s" : ""}?
        </h3>
        <p className="text-[#64748B] text-sm text-center mb-6">
          Esta ação é <span className="text-[#EF4444] font-semibold">permanente</span> e afetará o ranking dos jogadores envolvidos.
        </p>
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
            Apagar
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Match History Card ───────────────────────────────────────────────────────

function MatchHistoryCard({
  match,
  index,
  selectionMode,
  selected,
  onSelect,
}: {
  match: MatchSummary;
  index: number;
  selectionMode: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const winner = getWinner(match.teams);
  const teamA = match.teams.find((t) => t.name === "Time A") ?? match.teams[0];
  const teamB = match.teams.find((t) => t.name === "Time B") ?? match.teams[1];
  const duration = formatDuration(match.started_at, match.finished_at);

  const cardContent = (
    <div
      className={`bg-[#1E293B] border rounded-2xl p-4 transition-all active:scale-[0.98] ${
        selected
          ? "border-[#EF4444]/60 bg-[#EF4444]/5"
          : "border-[#334155]/60 hover:border-[#475569]"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectionMode && (
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                selected
                  ? "bg-[#EF4444] border-[#EF4444]"
                  : "border-[#475569]"
              }`}
            >
              {selected && <X size={11} className="text-white" />}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[#F1F5F9] font-bold truncate">{match.name}</p>
            <p className="text-[#64748B] text-xs mt-0.5 flex items-center gap-1.5">
              <Calendar size={11} />
              {formatDate(match.finished_at ?? match.created_at)}
              {duration && <span>· {duration}</span>}
            </p>
          </div>
        </div>
        {!selectionMode && (
          winner ? (
            <span className="flex items-center gap-1 bg-[#EAB308]/10 border border-[#EAB308]/25 text-[#EAB308] text-xs font-semibold px-2 py-1 rounded-xl shrink-0 ml-2">
              <Trophy size={11} />
              {winner.name}
            </span>
          ) : (
            <span className="bg-[#334155]/60 text-[#94A3B8] text-xs font-semibold px-2 py-1 rounded-xl shrink-0 ml-2">
              Empate
            </span>
          )
        )}
      </div>

      {teamA && teamB && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: teamA.color }} />
            <span className="text-[#94A3B8] text-sm truncate">{teamA.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-2xl font-bold font-display w-8 text-center"
              style={{ color: teamA.score > teamB.score ? "#F1F5F9" : "#475569" }}
            >
              {teamA.score}
            </span>
            <span className="text-[#334155] text-lg font-display">×</span>
            <span
              className="text-2xl font-bold font-display w-8 text-center"
              style={{ color: teamB.score > teamA.score ? "#F1F5F9" : "#475569" }}
            >
              {teamB.score}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-[#94A3B8] text-sm truncate text-right">{teamB.name}</span>
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: teamB.color }} />
          </div>
        </div>
      )}

      {(!teamA || !teamB) && (
        <p className="text-[#475569] text-sm">Times não registrados</p>
      )}

      {!selectionMode && (
        <div className="flex items-center justify-end mt-3 gap-1 text-[#3B82F6]">
          <span className="text-xs font-medium">Ver detalhes</span>
          <ChevronRight size={13} />
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 300, damping: 28 }}
    >
      {selectionMode ? (
        <button className="w-full text-left" onClick={() => onSelect(match.id)}>
          {cardContent}
        </button>
      ) : (
        <Link href={`/match/${match.id}/summary`}>{cardContent}</Link>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getMatchHistory().then(({ data, error }) => {
      if (error) setError(error);
      else setMatches(data);
      setLoading(false);
    });
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(matches.map((m) => m.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function handleDelete() {
    const ids = Array.from(selectedIds);
    setDeleting(true);
    const { error } = await deleteMatches(ids);
    setDeleting(false);
    if (error) {
      showToast(error, "error");
    } else {
      setMatches((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      showToast(
        `${ids.length} partida${ids.length !== 1 ? "s" : ""} apagada${ids.length !== 1 ? "s" : ""}.`,
        "success"
      );
      exitSelectionMode();
      setShowDeleteConfirm(false);
    }
  }

  const selectedCount = selectedIds.size;
  const allSelected = matches.length > 0 && selectedCount === matches.length;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-10">
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b border-[#334155]/50"
        style={{
          background: "rgba(15, 23, 42, 0.97)",
          backdropFilter: "blur(12px)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex items-center gap-3 px-4 h-14">
          {selectionMode ? (
            <button
              onClick={exitSelectionMode}
              className="text-[#64748B] hover:text-[#F1F5F9] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
            >
              <X size={22} />
            </button>
          ) : (
            <button
              onClick={() => router.back()}
              className="text-[#64748B] hover:text-[#F1F5F9] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
            >
              <ArrowLeft size={22} />
            </button>
          )}

          {selectionMode ? (
            <div className="flex-1 min-w-0">
              <p className="text-[#F1F5F9] font-bold font-display">
                {selectedCount > 0 ? `${selectedCount} selecionada${selectedCount !== 1 ? "s" : ""}` : "Selecionar partidas"}
              </p>
            </div>
          ) : (
            <h1 className="text-[#F1F5F9] font-bold font-display text-lg flex items-center gap-2 flex-1">
              <Clock size={18} className="text-[#3B82F6]" />
              Histórico
            </h1>
          )}

          {/* Right actions */}
          {!loading && matches.length > 0 && (
            <div className="flex items-center gap-2">
              {selectionMode ? (
                <>
                  <button
                    onClick={allSelected ? deselectAll : selectAll}
                    className="flex items-center gap-1.5 text-[#3B82F6] text-xs font-semibold min-h-[36px] px-2"
                  >
                    {allSelected ? <Square size={14} /> : <CheckSquare size={14} />}
                    {allSelected ? "Nenhum" : "Todos"}
                  </button>
                  {selectedCount > 0 && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs font-semibold px-3 py-1.5 rounded-lg min-h-[36px] hover:bg-[#EF4444]/20 transition-colors"
                    >
                      <Trash2 size={13} />
                      Apagar ({selectedCount})
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="text-[#64748B] hover:text-[#94A3B8] text-xs font-semibold min-h-[36px] px-2 transition-colors"
                >
                  Selecionar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 space-y-3">
        {/* Loading */}
        {loading && (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} height="110px" />
            ))}
          </>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-[#EF4444] text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && matches.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 bg-[#1E293B] rounded-3xl flex items-center justify-center mx-auto mb-4 border border-[#334155]">
              <Swords size={36} className="text-[#334155]" />
            </div>
            <h3 className="text-[#F1F5F9] font-bold font-display text-xl mb-2">
              Nenhuma partida ainda
            </h3>
            <p className="text-[#64748B] text-sm mb-6 max-w-xs mx-auto">
              Partidas encerradas aparecerão aqui com placar e detalhes completos.
            </p>
            <button
              onClick={() => router.push("/match/new")}
              className="bg-[#1D4ED8] text-white font-semibold px-6 py-3 rounded-2xl min-h-[48px] hover:bg-[#1E40AF] transition-colors"
            >
              Criar primeira partida ⚽
            </button>
          </motion.div>
        )}

        {/* Match list */}
        <AnimatePresence>
          {!loading &&
            matches.map((match, i) => (
              <MatchHistoryCard
                key={match.id}
                match={match}
                index={i}
                selectionMode={selectionMode}
                selected={selectedIds.has(match.id)}
                onSelect={toggleSelect}
              />
            ))}
        </AnimatePresence>
      </div>

      {/* Delete Confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <DeleteConfirmDialog
            count={selectedCount}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            loading={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

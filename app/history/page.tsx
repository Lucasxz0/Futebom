"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Clock, ChevronRight, Calendar, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMatchHistory, MatchSummary } from "@/services/historyService";
import SkeletonCard from "@/components/ui/SkeletonCard";

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
  if (sorted[0].score === sorted[1].score) return null; // empate
  return sorted[0];
}

// ─── Match History Card ───────────────────────────────────────────────────────

function MatchHistoryCard({ match, index }: { match: MatchSummary; index: number }) {
  const winner = getWinner(match.teams);
  const teamA = match.teams.find((t) => t.name === "Time A") ?? match.teams[0];
  const teamB = match.teams.find((t) => t.name === "Time B") ?? match.teams[1];
  const duration = formatDuration(match.started_at, match.finished_at);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 300, damping: 28 }}
    >
      <Link href={`/match/${match.id}/summary`}>
        <div className="bg-[#1E293B] border border-[#334155]/60 rounded-2xl p-4 hover:border-[#475569] transition-all active:scale-[0.98]">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              <p className="text-[#F1F5F9] font-bold truncate">{match.name}</p>
              <p className="text-[#64748B] text-xs mt-0.5 flex items-center gap-1.5">
                <Calendar size={11} />
                {formatDate(match.finished_at ?? match.created_at)}
                {duration && <span>· {duration}</span>}
              </p>
            </div>
            {winner ? (
              <span className="flex items-center gap-1 bg-[#EAB308]/10 border border-[#EAB308]/25 text-[#EAB308] text-xs font-semibold px-2 py-1 rounded-xl shrink-0 ml-2">
                <Trophy size={11} />
                {winner.name}
              </span>
            ) : (
              <span className="bg-[#334155]/60 text-[#94A3B8] text-xs font-semibold px-2 py-1 rounded-xl shrink-0 ml-2">
                Empate
              </span>
            )}
          </div>

          {/* Score */}
          {teamA && teamB && (
            <div className="flex items-center gap-3">
              {/* Team A */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: teamA.color }}
                />
                <span className="text-[#94A3B8] text-sm truncate">{teamA.name}</span>
              </div>

              {/* Scores */}
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

              {/* Team B */}
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <span className="text-[#94A3B8] text-sm truncate text-right">{teamB.name}</span>
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: teamB.color }}
                />
              </div>
            </div>
          )}

          {/* No teams yet */}
          {(!teamA || !teamB) && (
            <p className="text-[#475569] text-sm">Times não registrados</p>
          )}

          {/* Tap hint */}
          <div className="flex items-center justify-end mt-3 gap-1 text-[#3B82F6]">
            <span className="text-xs font-medium">Ver detalhes</span>
            <ChevronRight size={13} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMatchHistory().then(({ data, error }) => {
      if (error) setError(error);
      else setMatches(data);
      setLoading(false);
    });
  }, []);

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
          <button
            onClick={() => router.back()}
            className="text-[#64748B] hover:text-[#F1F5F9] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-[#F1F5F9] font-bold font-display text-lg flex items-center gap-2">
            <Clock size={18} className="text-[#3B82F6]" />
            Histórico
          </h1>
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
          {!loading && matches.map((match, i) => (
            <MatchHistoryCard key={match.id} match={match} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

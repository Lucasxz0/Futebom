"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Target, Zap, ShieldCheck, Users } from "lucide-react";
import { getPlayerRanking, PlayerRankingEntry } from "@/services/statsService";
import SkeletonCard from "@/components/ui/SkeletonCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "goals" | "assists" | "wins" | "matches" | "win_rate";

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  { key: "goals", label: "Gols", icon: <Target size={13} /> },
  { key: "assists", label: "Assists", icon: <Zap size={13} /> },
  { key: "wins", label: "Vitórias", icon: <ShieldCheck size={13} /> },
  { key: "win_rate", label: "Aproveit.", icon: <Trophy size={13} /> },
  { key: "matches", label: "Partidas", icon: <Users size={13} /> },
];

// ─── Medal colors ─────────────────────────────────────────────────────────────

function getMedalStyle(position: number): { color: string; bg: string } {
  if (position === 0) return { color: "#EAB308", bg: "rgba(234,179,8,0.15)" };
  if (position === 1) return { color: "#94A3B8", bg: "rgba(148,163,184,0.12)" };
  if (position === 2) return { color: "#CD7C2F", bg: "rgba(205,124,47,0.15)" };
  return { color: "#475569", bg: "transparent" };
}

// ─── Player Row ───────────────────────────────────────────────────────────────

function PlayerRow({
  entry,
  position,
  sortKey,
  index,
}: {
  entry: PlayerRankingEntry;
  position: number;
  sortKey: SortKey;
  index: number;
}) {
  const medal = getMedalStyle(position);
  const initials = entry.player_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const highlightValue =
    sortKey === "goals"
      ? entry.goals
      : sortKey === "assists"
      ? entry.assists
      : sortKey === "wins"
      ? entry.wins
      : sortKey === "win_rate"
      ? `${entry.win_rate}%`
      : entry.matches;

  const highlightLabel =
    sortKey === "goals"
      ? "gols"
      : sortKey === "assists"
      ? "assist"
      : sortKey === "wins"
      ? "vitórias"
      : sortKey === "win_rate"
      ? "aproveit."
      : "partidas";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 350, damping: 28 }}
      className="flex items-center gap-3 rounded-2xl px-4 py-3 border border-[#334155]/50"
      style={{ background: position < 3 ? medal.bg : "#1E293B" }}
    >
      {/* Position */}
      <span
        className="text-base font-black font-display w-6 text-center shrink-0"
        style={{ color: medal.color }}
      >
        {position + 1}
      </span>

      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{
          background:
            position === 0
              ? "linear-gradient(135deg, #EAB308, #CA8A04)"
              : position === 1
              ? "linear-gradient(135deg, #94A3B8, #64748B)"
              : position === 2
              ? "linear-gradient(135deg, #CD7C2F, #92400E)"
              : "#1D4ED8",
        }}
      >
        {initials}
      </div>

      {/* Name + secondary stats */}
      <div className="flex-1 min-w-0">
        <p className="text-[#F1F5F9] font-semibold truncate">{entry.player_name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {sortKey !== "goals" && (
            <span className="text-[#64748B] text-xs">⚽ {entry.goals}</span>
          )}
          {sortKey !== "assists" && (
            <span className="text-[#64748B] text-xs">🅰️ {entry.assists}</span>
          )}
          {sortKey !== "matches" && (
            <span className="text-[#64748B] text-xs">{entry.matches}P</span>
          )}
        </div>
      </div>

      {/* Highlight stat */}
      <div className="text-right shrink-0">
        <p
          className="text-xl font-black font-display leading-none"
          style={{ color: medal.color !== "#475569" ? medal.color : "#F1F5F9" }}
        >
          {highlightValue}
        </p>
        <p className="text-[#64748B] text-[10px]">{highlightLabel}</p>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RankingPage() {
  const [players, setPlayers] = useState<PlayerRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("goals");

  useEffect(() => {
    getPlayerRanking().then(({ data, error }) => {
      if (error) setError(error);
      else setPlayers(data);
      setLoading(false);
    });
  }, []);

  const sorted = [...players].sort((a, b) => {
    if (sortKey === "win_rate") return b.win_rate - a.win_rate;
    return (b[sortKey] as number) - (a[sortKey] as number);
  });

  return (
    <div className="min-h-screen bg-[#0F172A] pb-10">
      {/* Header */}
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={24} className="text-[#EAB308]" />
          <h1 className="text-[#F1F5F9] text-2xl font-bold font-display">Ranking</h1>
        </div>
        <p className="text-[#64748B] text-sm">Top jogadores de todas as suas peladas</p>
      </div>

      {/* Sort tabs */}
      <div className="px-4 mb-5">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {SORT_OPTIONS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all min-h-[36px] shrink-0 ${
                sortKey === key
                  ? "bg-[#1D4ED8] border-[#1D4ED8] text-white shadow-lg"
                  : "bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:border-[#475569]"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-2">
        {/* Loading */}
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} height="68px" />
        ))}

        {/* Error */}
        {error && !loading && (
          <p className="text-center text-[#EF4444] text-sm py-8">{error}</p>
        )}

        {/* Empty state */}
        {!loading && !error && players.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 bg-[#1E293B] border border-[#334155] rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Trophy size={36} className="text-[#334155]" />
            </div>
            <h3 className="text-[#F1F5F9] font-bold font-display text-xl mb-2">
              Ranking vazio
            </h3>
            <p className="text-[#64748B] text-sm max-w-xs mx-auto">
              Complete sua primeira partida para ver os jogadores classificados aqui.
            </p>
          </motion.div>
        )}

        {/* Podium (top 3) */}
        {!loading && sorted.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end justify-center gap-3 mb-6 pt-2"
          >
            {/* 2nd */}
            {[1, 0, 2].map((pos) => {
              const p = sorted[pos];
              if (!p) return null;
              const medal = getMedalStyle(pos);
              const initials = p.player_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
              const height = pos === 0 ? "h-20" : pos === 1 ? "h-14" : "h-10";
              const avatarSize = pos === 0 ? "w-14 h-14 text-base" : "w-11 h-11 text-sm";
              const stat = sortKey === "win_rate" ? `${p.win_rate}%` : p[sortKey];

              return (
                <div key={p.player_id} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-lg">{pos === 0 ? "🥇" : pos === 1 ? "🥈" : "🥉"}</span>
                  <div
                    className={`${avatarSize} rounded-2xl flex items-center justify-center font-black text-white`}
                    style={{
                      background:
                        pos === 0
                          ? "linear-gradient(135deg,#EAB308,#CA8A04)"
                          : pos === 1
                          ? "linear-gradient(135deg,#94A3B8,#64748B)"
                          : "linear-gradient(135deg,#CD7C2F,#92400E)",
                    }}
                  >
                    {initials}
                  </div>
                  <p className="text-[#F1F5F9] text-xs font-semibold text-center truncate w-full px-1">
                    {p.player_name.split(" ")[0]}
                  </p>
                  <p className="font-black font-display text-base" style={{ color: medal.color }}>
                    {stat}
                  </p>
                  <div
                    className={`w-full ${height} rounded-t-xl`}
                    style={{ background: `${medal.color}20`, border: `1px solid ${medal.color}30` }}
                  />
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Full list */}
        <AnimatePresence mode="popLayout">
          {!loading && sorted.map((entry, i) => (
            <PlayerRow
              key={entry.player_id}
              entry={entry}
              position={i}
              sortKey={sortKey}
              index={i}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

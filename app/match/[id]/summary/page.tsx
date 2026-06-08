"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  Clock,
  Calendar,
  Users,
  Flag,
  ArrowLeftRight,
} from "lucide-react";
import { getMatchDetail, MatchDetail } from "@/services/historyService";
import SkeletonCard from "@/components/ui/SkeletonCard";
import VoteSection from "@/components/match/VoteSection";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function formatDuration(started: string | null, finished: string | null): string {
  if (!started || !finished) return "—";
  const mins = Math.round(
    (new Date(finished).getTime() - new Date(started).getTime()) / 60000
  );
  if (mins < 60) return `${mins} minutos`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ""}`;
}

function getWinner(teams: MatchDetail["teams"]) {
  if (teams.length < 2) return null;
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  if (sorted[0].score === sorted[1].score) return null;
  return sorted[0];
}

// ─── Final Score Card ─────────────────────────────────────────────────────────

function FinalScoreCard({ match }: { match: MatchDetail }) {
  const teamA = match.teams.find((t) => t.name === "Time A") ?? match.teams[0];
  const teamB = match.teams.find((t) => t.name === "Time B") ?? match.teams[1];
  const winner = getWinner(match.teams);
  const duration = formatDuration(match.started_at, match.finished_at);

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #1E293B 0%, #0F172A 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Glow spots */}
      {teamA && (
        <div
          className="absolute top-0 left-0 w-32 h-32 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: teamA.color }}
        />
      )}
      {teamB && (
        <div
          className="absolute bottom-0 right-0 w-32 h-32 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: teamB.color }}
        />
      )}

      <div className="relative px-5 py-5">
        {/* Meta */}
        <div className="flex items-center justify-center gap-4 mb-5 flex-wrap">
          <span className="flex items-center gap-1.5 text-[#64748B] text-xs">
            <Calendar size={12} />
            {formatDate(match.finished_at ?? match.created_at)}
          </span>
          <span className="flex items-center gap-1.5 text-[#64748B] text-xs">
            <Clock size={12} />
            {duration}
          </span>
        </div>

        {/* Scores */}
        {teamA && teamB && (
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <p className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: teamA.color }}>
                {teamA.name}
              </p>
              <p
                className="text-[5.5rem] font-bold font-display leading-none"
                style={{ color: teamA.score > teamB.score ? "#F1F5F9" : "#475569" }}
              >
                {teamA.score}
              </p>
            </div>

            <div className="flex flex-col items-center px-2">
              <div className="w-px h-10 bg-[#334155]" />
              <span className="text-[#475569] text-xs font-display my-1">FINAL</span>
              <div className="w-px h-10 bg-[#334155]" />
            </div>

            <div className="flex-1 text-center">
              <p className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: teamB.color }}>
                {teamB.name}
              </p>
              <p
                className="text-[5.5rem] font-bold font-display leading-none"
                style={{ color: teamB.score > teamA.score ? "#F1F5F9" : "#475569" }}
              >
                {teamB.score}
              </p>
            </div>
          </div>
        )}

        {/* Winner badge */}
        <div className="flex justify-center mt-4">
          {winner ? (
            <span className="flex items-center gap-2 bg-[#EAB308]/10 border border-[#EAB308]/30 text-[#EAB308] font-semibold px-4 py-2 rounded-full text-sm">
              <Trophy size={15} />
              Vencedor: {winner.name}
            </span>
          ) : (
            <span className="bg-[#334155]/60 text-[#94A3B8] font-semibold px-4 py-2 rounded-full text-sm">
              🤝 Empate
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Roster ───────────────────────────────────────────────────────────────────

function RosterSection({ match }: { match: MatchDetail }) {
  const teamsMap: Record<string, { name: string; color: string; players: typeof match.players }> = {};

  match.teams.forEach((t) => {
    teamsMap[t.id] = { name: t.name, color: t.color, players: [] };
  });

  match.players.forEach((p) => {
    if (p.team_id && teamsMap[p.team_id]) {
      teamsMap[p.team_id].players.push(p);
    }
  });

  const reserves = match.players.filter((p) => !p.team_id);

  return (
    <div className="space-y-3">
      <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
        <Users size={12} />
        Elenco
      </p>

      {Object.values(teamsMap).map((team) => (
        <div
          key={team.name}
          className="rounded-2xl overflow-hidden border"
          style={{ borderColor: `${team.color}30` }}
        >
          <div
            className="px-4 py-2.5 flex items-center gap-2"
            style={{ background: `${team.color}15` }}
          >
            <div className="w-3 h-3 rounded-full" style={{ background: team.color }} />
            <span className="font-bold text-sm" style={{ color: team.color }}>
              {team.name}
            </span>
            <span className="text-[#64748B] text-xs ml-auto">{team.players.length} jog.</span>
          </div>
          <div className="px-4 py-2 space-y-2">
            {team.players.length === 0 ? (
              <p className="text-[#475569] text-sm py-1">Sem jogadores</p>
            ) : (
              team.players.map((p, i) => {
                const initials = p.player_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                // Count goals for this player in this match
                const goals = match.events.filter(
                  (e) => e.player_id === p.player_id && e.event_type === "goal"
                ).length;
                const assists = match.events.filter(
                  (e) => e.player_id === p.player_id && e.event_type === "assist"
                ).length;

                return (
                  <div key={p.player_id} className="flex items-center gap-3">
                    <span className="text-[#475569] text-xs w-4 text-center font-mono">{i + 1}</span>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: team.color }}
                    >
                      {initials}
                    </div>
                    <span className="text-[#F1F5F9] text-sm flex-1 truncate">{p.player_name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {goals > 0 && (
                        <span className="text-xs text-[#94A3B8]">
                          ⚽ {goals}
                        </span>
                      )}
                      {assists > 0 && (
                        <span className="text-xs text-[#64748B]">
                          🅰️ {assists}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}

      {reserves.length > 0 && (
        <div className="bg-[#1E293B] border border-[#334155]/60 rounded-2xl px-4 py-3">
          <p className="text-[#64748B] text-xs font-semibold mb-2">Reservas</p>
          <div className="flex flex-wrap gap-2">
            {reserves.map((p) => (
              <span key={p.player_id} className="bg-[#334155] text-[#94A3B8] text-xs px-2 py-1 rounded-lg">
                {p.player_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Events Feed ─────────────────────────────────────────────────────────────

function EventsSection({ match }: { match: MatchDetail }) {
  const relevant = match.events.filter(
    (e) => e.event_type === "goal" || e.event_type === "assist" || e.event_type === "substitution"
  );

  if (relevant.length === 0) {
    return (
      <div className="text-center py-6 bg-[#1E293B] border border-dashed border-[#334155] rounded-2xl">
        <p className="text-[#475569] text-sm">Nenhum evento registrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
        <Flag size={12} />
        Eventos da partida
      </p>
      {relevant.map((event) => {
        const isGoal = event.event_type === "goal";
        const isAssist = event.event_type === "assist";
        const isSub = event.event_type === "substitution";
        const teamColor = match.teams.find((t) => t.id === event.team_id)?.color;

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 bg-[#1E293B] border border-[#334155]/50 rounded-2xl px-4 py-3"
          >
            <span className="text-lg shrink-0">
              {isGoal ? "⚽" : isAssist ? "🅰️" : "🔄"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[#F1F5F9] text-sm font-semibold truncate">
                {event.player_name ?? (isGoal ? "Gol" : isSub ? "Substituição" : "Assistência")}
                {event.team_name && (
                  <span className="text-[#64748B] font-normal"> — {event.team_name}</span>
                )}
              </p>
              <p className="text-[#475569] text-xs">{event.minute}′</p>
            </div>
            {teamColor && (
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: teamColor }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMatchDetail(id).then(({ data, error }) => {
      if (error) setError(error);
      else setMatch(data);
      setLoading(false);
    });
  }, [id]);

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
          <h1 className="text-[#F1F5F9] font-bold font-display truncate">
            {match?.name ?? "Detalhes da Partida"}
          </h1>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5 relative">
        {loading && (
          <>
            <SkeletonCard height="240px" />
            <SkeletonCard height="180px" />
            <SkeletonCard height="140px" />
          </>
        )}

        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-[#EF4444] text-sm">{error}</p>
          </div>
        )}

        {match && !loading && (
          <>
            <FinalScoreCard match={match} />
            <RosterSection match={match} />
            <EventsSection match={match} />
            {/* Voting — only for finished matches with players */}
            {match.status === "finished" && match.players.length > 0 && (
              <VoteSection
                matchId={match.id}
                players={match.players.map((p) => ({
                  player_id: p.player_id,
                  player_name: p.player_name,
                }))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

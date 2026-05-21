"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Trophy, Clock, Hash, ArrowRight, Swords, Calendar, RefreshCw, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { findMatchByCode } from "@/services/matchService";
import { getRecentMatches, MatchSummary } from "@/services/historyService";
import { getPlayerRanking, PlayerRankingEntry } from "@/services/statsService";
import { useToast } from "@/components/ui/Toast";
import SkeletonCard from "@/components/ui/SkeletonCard";
import Button from "@/components/ui/Button";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getUserName(user: { user_metadata?: { name?: string }; email?: string } | null): string {
  if (!user) return "Jogador";
  return user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Jogador";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [recentMatches, setRecentMatches] = useState<MatchSummary[]>([]);
  const [topPlayers, setTopPlayers] = useState<PlayerRankingEntry[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const greeting = getGreeting();
  const name = getUserName(user);

  const loadData = useCallback(async () => {
    const [matchRes, rankRes] = await Promise.all([
      getRecentMatches(5),
      getPlayerRanking(),
    ]);
    setRecentMatches(matchRes.data);
    setTopPlayers(rankRes.data.slice(0, 3));
    setLoadingMatches(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Pull-to-refresh
  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  async function handleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (delta > 72 && scrollTop <= 0 && !refreshing) {
      setRefreshing(true);
      await loadData();
      setRefreshing(false);
    }
  }

  const liveMatch = recentMatches.find((m) => m.status === "in_progress");
  const nonLiveMatches = recentMatches.filter((m) => m.status !== "in_progress");

  async function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    const { matchId, error } = await findMatchByCode(code);
    setJoining(false);
    if (error) {
      showToast(error, "error");
      return;
    }
    if (matchId) {
      router.push(`/match/${matchId}/lobby`);
    }
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#0F172A] px-4 pt-14 overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-center gap-2 py-2 text-[#3B82F6] text-xs font-semibold"
          >
            <RefreshCw size={13} className="animate-spin" />
            Atualizando...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="pt-4 pb-4">
        <p className="text-[#94A3B8] text-sm font-medium">{greeting} 👋</p>
        <h1 className="text-[#F1F5F9] text-2xl font-bold font-display mt-0.5">
          {name}!
        </h1>
      </div>

      {/* ═══ LIVE MATCH HERO — replaces CTA when there's a live match ═══ */}
      <AnimatePresence mode="wait">
        {liveMatch ? (
          <motion.button
            key="live"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            onClick={() => router.push(`/match/${liveMatch.id}/play`)}
            className="w-full relative overflow-hidden rounded-2xl p-5 mb-6 text-left"
            style={{
              background: "linear-gradient(135deg, #064E3B 0%, #065F46 50%, #047857 100%)",
              boxShadow: "0 4px 24px rgba(34,197,94,0.3)",
              border: "1px solid rgba(34,197,94,0.25)",
            }}
          >
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
            <div className="flex items-start gap-3 relative z-10">
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                  <span className="text-[#22C55E] text-xs font-bold tracking-wider uppercase">Ao Vivo agora</span>
                </div>
                <h2 className="text-white text-xl font-bold font-display truncate">{liveMatch.name}</h2>
                {liveMatch.teams.length >= 2 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-white/90 font-display font-black text-2xl">
                      {(liveMatch.teams.find((t) => t.name === "Time A") ?? liveMatch.teams[0])?.score ?? 0}
                    </span>
                    <span className="text-white/40 font-display">×</span>
                    <span className="text-white/90 font-display font-black text-2xl">
                      {(liveMatch.teams.find((t) => t.name === "Time B") ?? liveMatch.teams[1])?.score ?? 0}
                    </span>
                  </div>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-1 bg-[#22C55E]/20 border border-[#22C55E]/30 text-[#22C55E] font-bold text-sm px-3 py-1.5 rounded-xl mt-1">
                <Zap size={14} />
                Entrar
              </div>
            </div>
          </motion.button>
        ) : (
          <motion.div
            key="cta"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="relative overflow-hidden rounded-2xl p-5 mb-6"
            style={{
              background: "linear-gradient(135deg, #1D4ED8 0%, #1E40AF 60%, #1e3a8a 100%)",
              boxShadow: "0 4px 24px rgba(29,78,216,0.4)",
            }}
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
            <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
            <div className="relative z-10">
              <div className="text-4xl mb-2">⚽</div>
              <h2 className="text-white text-xl font-bold font-display">Nova Partida</h2>
              <p className="text-blue-200 text-sm mt-1 mb-4">Sorteie times e comece agora</p>
              <Button id="btn-nova-partida" variant="white" onClick={() => router.push("/match/new")} className="w-full">
                Criar Partida
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entrar por código */}
      <form onSubmit={handleJoinByCode} className="mb-6">
        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-4">
          <p className="text-[#94A3B8] text-sm font-semibold mb-3 flex items-center gap-2">
            <Hash size={15} className="text-[#3B82F6]" />
            Entrar numa partida
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="Código (ex: AB3K7Z)"
              maxLength={6}
              className="flex-1 bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-2.5 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors text-base font-mono tracking-widest uppercase min-h-[44px]"
            />
            <Button
              type="submit"
              variant="primary"
              loading={joining}
              disabled={code.length < 6}
              className="px-4 shrink-0"
            >
              <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </form>

      {/* Últimas Partidas */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#F1F5F9] text-lg font-bold font-display flex items-center gap-2">
            <Clock size={18} className="text-[#3B82F6]" />
            Últimas Partidas
          </h2>
          <Link href="/history" className="text-[#3B82F6] text-sm font-medium flex items-center gap-0.5 min-h-[44px] flex items-center">
            Ver tudo <ChevronRight size={14} />
          </Link>
        </div>

        {loadingMatches && (
          <div className="space-y-3">
            <SkeletonCard height="72px" />
            <SkeletonCard height="72px" />
          </div>
        )}

        {!loadingMatches && nonLiveMatches.length === 0 && !liveMatch && (
          <div className="text-center py-6 bg-[#1E293B] border border-dashed border-[#334155] rounded-2xl">
            <Swords size={28} className="text-[#334155] mx-auto mb-2" />
            <p className="text-[#64748B] text-sm">Suas partidas aparecerão aqui</p>
          </div>
        )}

        {!loadingMatches && nonLiveMatches.length > 0 && (
          <div className="space-y-2">
            {nonLiveMatches.map((match) => {
              const teamA = match.teams.find((t) => t.name === "Time A") ?? match.teams[0];
              const teamB = match.teams.find((t) => t.name === "Time B") ?? match.teams[1];
              return (
                <Link key={match.id} href={`/match/${match.id}/summary`}>
                  <div className="bg-[#1E293B] border border-[#334155]/60 rounded-2xl px-4 py-3 hover:border-[#475569] transition-all active:scale-[0.98] flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[#F1F5F9] font-semibold text-sm truncate">{match.name}</p>
                      <p className="text-[#64748B] text-xs flex items-center gap-1 mt-0.5">
                        <Calendar size={10} />
                        {new Date(match.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {teamA && teamB && (
                      <div className="flex items-center gap-1.5 shrink-0 font-display font-bold">
                        <span style={{ color: teamA.color }}>{teamA.score}</span>
                        <span className="text-[#334155] text-xs">×</span>
                        <span style={{ color: teamB.color }}>{teamB.score}</span>
                      </div>
                    )}
                    <ChevronRight size={15} className="text-[#475569] shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Ranking Rápido */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#F1F5F9] text-lg font-bold font-display flex items-center gap-2">
            <Trophy size={18} className="text-[#EAB308]" />
            Ranking Rápido
          </h2>
          <Link href="/ranking" className="text-[#3B82F6] text-sm font-medium flex items-center gap-0.5 min-h-[44px] flex items-center">
            Ver tudo <ChevronRight size={14} />
          </Link>
        </div>

        {loadingMatches && (
          <div className="space-y-2">
            {[1,2,3].map((i) => <SkeletonCard key={i} height="52px" />)}
          </div>
        )}

        {!loadingMatches && topPlayers.length === 0 && (
          <div className="text-center py-6 bg-[#1E293B] border border-dashed border-[#334155] rounded-2xl">
            <Trophy size={24} className="text-[#334155] mx-auto mb-2" />
            <p className="text-[#64748B] text-sm">Ranking disponível após a primeira partida</p>
          </div>
        )}

        {!loadingMatches && topPlayers.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-[#334155]/60">
            {topPlayers.map((p, i) => {
              const MEDAL_COLORS = ["#EAB308", "#94A3B8", "#CD7C2F"];
              const color = MEDAL_COLORS[i] ?? "#475569";
              const initials = p.player_name.split(" ").slice(0,2).map((w) => w[0]).join("").toUpperCase();
              return (
                <div
                  key={p.player_id}
                  className={`flex items-center gap-3 px-4 py-3 bg-[#1E293B] ${
                    i < topPlayers.length - 1 ? "border-b border-[#334155]/40" : ""
                  }`}
                >
                  <span className="text-base font-black font-display w-5 text-center" style={{ color }}>{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#1D4ED8" }}>
                    {initials}
                  </div>
                  <span className="text-[#F1F5F9] text-sm font-semibold flex-1 truncate">{p.player_name}</span>
                  <span className="text-xs text-[#64748B]">⚽ {p.goals}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

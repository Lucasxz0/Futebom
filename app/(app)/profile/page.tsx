"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGroup } from "@/contexts/GroupContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LogOut,
  Trophy,
  Target,
  Zap,
  ShieldCheck,
  TrendingUp,
  Swords,
  ChevronRight,
  Users,
  ArrowLeftRight,
  Settings,
} from "lucide-react";
import Button from "@/components/ui/Button";
import SkeletonCard from "@/components/ui/SkeletonCard";
import { getPersonalStats, PersonalStats } from "@/services/statsService";

// ─── Group Section ────────────────────────────────────────────────────────────

function GroupSection() {
  const { activeGroup, myGroups, isAdmin, isLoading, handleLeaveGroup } = useGroup();
  const router = useRouter();

  if (isLoading) {
    return <SkeletonCard height="110px" />;
  }

  return (
    <div className="rounded-2xl border border-[#334155]/60 overflow-hidden bg-[#1E293B]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#334155]/60">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-[#3B82F6]" />
          <span className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide">
            Grupo ativo
          </span>
        </div>
        {isAdmin && (
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-1 text-[#F59E0B] text-xs font-semibold hover:text-[#FCD34D] transition-colors"
          >
            <Settings size={12} />
            Admin
          </button>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {activeGroup ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{activeGroup.emoji ?? "⚽"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[#F1F5F9] font-bold leading-tight truncate">
                  {activeGroup.name}
                </p>
                <p className="text-[#64748B] text-xs">
                  {activeGroup.member_count}{" "}
                  {activeGroup.member_count === 1 ? "membro" : "membros"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => router.push("/groups")}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1D4ED8]/15 border border-[#1D4ED8]/30 text-[#3B82F6] rounded-xl py-2.5 text-sm font-bold hover:bg-[#1D4ED8]/25 transition-colors min-h-[44px]"
              >
                <ArrowLeftRight size={14} />
                Trocar grupo
              </button>

              {myGroups.length > 1 && (
                <button
                  onClick={async () => {
                    if (confirm(`Sair do grupo "${activeGroup.name}"?`)) {
                      await handleLeaveGroup(activeGroup.id);
                    }
                  }}
                  className="flex items-center justify-center border border-[#334155] text-[#64748B] rounded-xl px-3 py-2.5 text-xs font-semibold hover:border-[#EF4444]/40 hover:text-[#EF4444] transition-colors min-h-[44px]"
                >
                  Sair
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-[#64748B] text-sm">
              Você não está em nenhum grupo. Entre em um grupo para ver o histórico compartilhado.
            </p>
            <button
              onClick={() => router.push("/groups")}
              className="w-full flex items-center justify-center gap-2 bg-[#1D4ED8] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#1E40AF] transition-colors min-h-[48px]"
            >
              Ver grupos disponíveis
            </button>
          </>
        )}
      </div>
    </div>
  );
}


// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 25 }}
      className="rounded-2xl p-4 flex flex-col gap-2 border border-[#334155]/60"
      style={{ background: "#1E293B" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: `${color}20` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p
          className="text-2xl font-black font-display leading-none"
          style={{ color: "#F1F5F9" }}
        >
          {value}
        </p>
        <p className="text-[#64748B] text-xs mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

// ─── Win Rate Ring ────────────────────────────────────────────────────────────

function WinRateRing({ rate, wins, draws, losses }: {
  rate: number;
  wins: number;
  draws: number;
  losses: number;
}) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (rate / 100) * circ;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="bg-[#1E293B] border border-[#334155]/60 rounded-2xl p-5"
    >
      <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
        <TrendingUp size={12} />
        Aproveitamento geral
      </p>

      <div className="flex items-center gap-6">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg width="100" height="100" className="-rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#1D4ED8" strokeWidth="8" opacity="0.15" />
            <motion.circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="#1D4ED8"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[#F1F5F9] text-2xl font-black font-display leading-none">
              {rate}%
            </span>
            <span className="text-[#64748B] text-[10px]">vit.</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2.5">
          {[
            { label: "Vitórias", value: wins, color: "#22C55E" },
            { label: "Empates", value: draws, color: "#EAB308" },
            { label: "Derrotas", value: losses, color: "#EF4444" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[#94A3B8] text-sm flex-1">{label}</span>
              <span className="text-[#F1F5F9] font-bold font-display text-sm">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const name = user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "Jogador";
  const email = user?.email ?? "";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    getPersonalStats().then(({ data }) => {
      setStats(data);
      setLoadingStats(false);
    });
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/auth/login");
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-10">
      {/* Hero header */}
      <div
        className="relative overflow-hidden px-4 pt-14 pb-8"
        style={{
          background: "linear-gradient(160deg, #1E293B 0%, #0F172A 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-[#1D4ED8]/10 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black font-display text-white shrink-0"
            style={{
              background: "linear-gradient(135deg, #1D4ED8, #1E40AF)",
              boxShadow: "0 8px 24px rgba(29,78,216,0.4)",
            }}
          >
            {initials}
          </motion.div>

          <div className="min-w-0">
            <motion.h1
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[#F1F5F9] text-2xl font-bold font-display truncate"
            >
              {name}
            </motion.h1>
            <p className="text-[#64748B] text-sm truncate">{email}</p>
            <span className="inline-flex items-center gap-1 bg-[#1D4ED8]/20 border border-[#1D4ED8]/30 text-[#3B82F6] text-xs font-semibold px-2 py-0.5 rounded-full mt-1">
              <Swords size={10} />
              Organizador
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Stats grid */}
        {loadingStats ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} height="88px" />
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<Users size={18} />} label="Partidas" value={stats.matches} color="#3B82F6" delay={0} />
              <StatCard icon={<Target size={18} />} label="Gols (partidas)" value={stats.goals} color="#22C55E" delay={0.05} />
              <StatCard icon={<Zap size={18} />} label="Assistências" value={stats.assists} color="#EAB308" delay={0.1} />
              <StatCard icon={<ShieldCheck size={18} />} label="Vitórias" value={stats.wins} color="#1D4ED8" delay={0.15} />
            </div>

            <WinRateRing
              rate={stats.win_rate}
              wins={stats.wins}
              draws={stats.draws}
              losses={stats.losses}
            />
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-[#64748B] text-sm">Nenhuma partida ainda</p>
          </div>
        )}

        {/* Group section */}
        <GroupSection />

        {/* Quick actions */}
        <div className="rounded-2xl overflow-hidden border border-[#334155]/60">
          {[
            {
              icon: <Swords size={18} className="text-[#3B82F6]" />,
              label: "Minhas Partidas",
              onClick: () => router.push("/history"),
            },
            {
              icon: <Trophy size={18} className="text-[#EAB308]" />,
              label: "Ver Ranking",
              onClick: () => router.push("/ranking"),
            },
          ].map(({ icon, label, onClick }, i) => (
            <button
              key={label}
              onClick={onClick}
              className={`w-full flex items-center gap-3 px-4 py-4 min-h-[56px] bg-[#1E293B] hover:bg-[#263348] transition-colors ${
                i > 0 ? "border-t border-[#334155]/60" : ""
              }`}
            >
              {icon}
              <span className="text-[#F1F5F9] text-sm font-medium flex-1 text-left">
                {label}
              </span>
              <ChevronRight size={16} className="text-[#64748B]" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <Button
          id="btn-logout"
          variant="danger"
          onClick={handleSignOut}
          loading={signingOut}
          className="w-full"
        >
          <LogOut size={16} />
          Sair da conta
        </Button>
      </div>
    </div>
  );
}

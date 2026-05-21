"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Check,
  Share2,
  Swords,
  Users,
  RefreshCw,
  ShieldCheck,
  Play,
} from "lucide-react";
import { getMatchById, MatchWithTeams } from "@/services/matchService";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import SkeletonCard from "@/components/ui/SkeletonCard";

// ─── Access Code Box ──────────────────────────────────────────────────────────

function AccessCodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      showToast("Código copiado!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Não foi possível copiar.", "error");
    }
  }

  async function share() {
    const text = `Entre na pelada com o código: ${code}\n⚽ Abra o Pelada App e digite o código para participar!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pelada App", text });
      } catch {
        // User dismissed
      }
    } else {
      copyCode();
    }
  }

  return (
    <div
      className="rounded-2xl p-5 border border-[#334155] text-center"
      style={{ background: "linear-gradient(135deg, #1E293B 0%, #263348 100%)" }}
    >
      <p className="text-[#64748B] text-xs font-semibold uppercase tracking-widest mb-3">
        Código de Acesso
      </p>
      <div className="flex items-center justify-center gap-2 mb-4">
        {code.split("").map((char, i) => (
          <span
            key={i}
            className="w-10 h-12 bg-[#0F172A] border border-[#1D4ED8]/40 rounded-xl flex items-center justify-center text-[#3B82F6] text-2xl font-bold font-display"
          >
            {char}
          </span>
        ))}
      </div>
      <p className="text-[#64748B] text-xs mb-4">
        Compartilhe com seus amigos para entrarem na partida
      </p>
      <div className="flex gap-2">
        <button
          onClick={copyCode}
          className="flex-1 flex items-center justify-center gap-2 bg-[#0F172A] border border-[#334155] hover:border-[#475569] text-[#94A3B8] rounded-xl py-3 text-sm font-semibold transition-all min-h-[44px]"
        >
          {copied ? <Check size={15} className="text-[#22C55E]" /> : <Copy size={15} />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
        <button
          onClick={share}
          className="flex-1 flex items-center justify-center gap-2 bg-[#1D4ED8]/20 border border-[#1D4ED8]/40 hover:bg-[#1D4ED8]/30 text-[#3B82F6] rounded-xl py-3 text-sm font-semibold transition-all min-h-[44px]"
        >
          <Share2 size={15} />
          Compartilhar
        </button>
      </div>
    </div>
  );
}

// ─── Team Card ────────────────────────────────────────────────────────────────

const TEAM_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  "#1D4ED8": {
    bg: "bg-[#1D4ED8]/10",
    border: "border-[#1D4ED8]/40",
    text: "text-[#3B82F6]",
    badge: "bg-[#1D4ED8]",
  },
  "#EF4444": {
    bg: "bg-[#EF4444]/10",
    border: "border-[#EF4444]/40",
    text: "text-[#EF4444]",
    badge: "bg-[#EF4444]",
  },
  "#64748B": {
    bg: "bg-[#334155]/30",
    border: "border-[#334155]/60",
    text: "text-[#94A3B8]",
    badge: "bg-[#475569]",
  },
};

function TeamCard({
  team,
  index,
}: {
  team: MatchWithTeams["teams"][0];
  index: number;
}) {
  const colors = TEAM_COLORS[team.color] ?? TEAM_COLORS["#64748B"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 25 }}
      className={`rounded-2xl border ${colors.border} ${colors.bg} overflow-hidden`}
    >
      {/* Team header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${colors.border}`}>
        <div
          className={`w-8 h-8 ${colors.badge} rounded-lg flex items-center justify-center`}
        >
          <Swords size={16} className="text-white" />
        </div>
        <h3 className={`font-bold font-display text-lg ${colors.text}`}>
          {team.name}
        </h3>
        <span className="ml-auto text-[#64748B] text-sm font-mono">
          {team.players.length} jogadores
        </span>
      </div>

      {/* Players list */}
      <div className="px-4 py-3 space-y-2">
        {team.players.length === 0 ? (
          <p className="text-[#475569] text-sm text-center py-2">Sem jogadores</p>
        ) : (
          team.players.map((p, i) => {
            const initials = p.player_name
              .split(" ")
              .slice(0, 2)
              .map((w: string) => w[0])
              .join("")
              .toUpperCase();

            return (
              <div key={p.player_id} className="flex items-center gap-3">
                <span className="text-[#475569] text-xs font-mono w-4 text-center">
                  {i + 1}
                </span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${colors.badge} text-white`}
                >
                  {initials}
                </div>
                <span className="text-[#F1F5F9] text-sm font-medium flex-1 truncate">
                  {p.player_name}
                </span>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [match, setMatch] = useState<MatchWithTeams | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatch = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await getMatchById(id);
    if (fetchErr) {
      setError(fetchErr);
    } else {
      setMatch(data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  function handleStartMatch() {
    // Fase 4 — tela da partida ao vivo
    showToast("Tela da partida disponível na Fase 4!", "info");
    // router.push(`/match/${id}/play`);
  }

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
            onClick={() => router.push("/dashboard")}
            className="text-[#64748B] hover:text-[#F1F5F9] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
            aria-label="Voltar ao dashboard"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[#F1F5F9] font-bold font-display truncate">
              {match?.name ?? "Carregando..."}
            </h1>
            {match && (
              <p className="text-[#64748B] text-xs">Lobby · Aguardando início</p>
            )}
          </div>
          {!loading && (
            <button
              onClick={fetchMatch}
              className="text-[#64748B] hover:text-[#3B82F6] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Atualizar"
            >
              <RefreshCw size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Loading state */}
        {loading && (
          <>
            <SkeletonCard height="148px" />
            <SkeletonCard height="200px" />
            <SkeletonCard height="200px" />
          </>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-[#EF4444] mb-4">{error}</p>
            <Button variant="secondary" onClick={fetchMatch}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Match loaded */}
        <AnimatePresence>
          {match && !loading && (
            <>
              {/* Access code */}
              <AccessCodeBox code={match.access_code} />

              {/* Teams */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Users size={15} className="text-[#64748B]" />
                  <span className="text-[#94A3B8] text-sm font-semibold uppercase tracking-wide">
                    Times Sorteados
                  </span>
                  <span className="ml-auto text-[#64748B] text-xs">
                    {match.teams.reduce((acc, t) => acc + t.players.length, 0)} jogadores
                  </span>
                </div>

                <div className="space-y-3">
                  {match.teams.map((team, i) => (
                    <TeamCard key={team.id} team={team} index={i} />
                  ))}
                </div>
              </div>

              {/* Status bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-3 bg-[#1E293B] border border-[#334155] rounded-2xl px-4 py-3"
              >
                <div className="w-2 h-2 bg-[#EAB308] rounded-full animate-pulse" />
                <span className="text-[#94A3B8] text-sm">
                  Aguardando início da partida...
                </span>
                <ShieldCheck size={15} className="text-[#64748B] ml-auto" />
              </motion.div>

              {/* Start button */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  variant="primary"
                  className="w-full text-base"
                  onClick={() => router.push(`/match/${id}/play`)}
                >
                  <Play size={18} />
                  Iniciar Partida
                </Button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

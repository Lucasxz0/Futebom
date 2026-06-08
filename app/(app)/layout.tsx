"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Trophy, Users, User, Camera, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useGroup } from "@/contexts/GroupContext";

// ─── Live match detection ─────────────────────────────────────────────────────

function useLiveMatch() {
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function checkLive() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("matches")
        .select("id")
        .eq("creator_id", user.id)
        .eq("status", "in_progress")
        .limit(1)
        .maybeSingle();
      setLiveMatchId(data?.id ?? null);
    }

    checkLive();

    // Subscribe to status changes so the badge appears/disappears in realtime
    supabase
      .channel("nav-live-match")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => checkLive()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(supabase.channel("nav-live-match"));
    };
  }, []);

  return liveMatchId;
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/ranking", icon: Trophy, label: "Ranking" },
  { href: "/media", icon: Camera, label: "Fotos" },
  { href: "/players", icon: Users, label: "Jogadores" },
  { href: "/profile", icon: User, label: "Perfil" },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const liveMatchId = useLiveMatch();
  const { activeGroup, isAdmin } = useGroup();

  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-[#0F172A]">
      {/* Group / Admin top bar */}
      {activeGroup && (
        <div
          className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-9"
          style={{
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderBottom: "1px solid rgba(51,65,85,0.5)",
          }}
        >
          <button
            onClick={() => router.push("/groups")}
            className="flex items-center gap-1.5 text-[#64748B] text-xs hover:text-[#94A3B8] transition-colors"
          >
            <span className="text-sm">{activeGroup.emoji ?? "⚽"}</span>
            <span className="font-semibold truncate max-w-[160px]">{activeGroup.name}</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => router.push("/admin")}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors"
              title="Painel Admin"
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      )}

      {/* Main content */}
      <main className={`flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+4.5rem)] ${activeGroup ? "pt-9" : ""}`}>
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#334155]"
        style={{
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Live match banner — appears above nav when there's a live match */}
        {liveMatchId && !pathname.includes("/play") && (
          <button
            onClick={() => router.push(`/match/${liveMatchId}/play`)}
            className="w-full flex items-center justify-center gap-2 bg-[#22C55E]/15 border-b border-[#22C55E]/20 py-1.5 text-xs font-semibold text-[#22C55E] transition-all hover:bg-[#22C55E]/20"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            Partida ao vivo — Toque para entrar
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
          </button>
        )}

        <div className="flex items-center justify-around h-[56px]">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            const isHome = href === "/dashboard";

            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-center gap-0.5 min-w-[60px] min-h-[44px] touch-feedback"
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Live badge on Home icon */}
                {isHome && liveMatchId && (
                  <span className="absolute -top-0.5 right-2.5 w-2 h-2 rounded-full bg-[#22C55E] border-2 border-[#0F172A] animate-pulse z-10" />
                )}

                <Icon
                  size={22}
                  className={isActive ? "text-[#3B82F6]" : "text-[#64748B]"}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? "text-[#3B82F6]" : "text-[#64748B]"
                  }`}
                >
                  {label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[#3B82F6]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

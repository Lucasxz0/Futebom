"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, RefreshCw, Settings } from "lucide-react";
import { useGroup } from "@/contexts/GroupContext";
import { getAllGroups, Group } from "@/services/groupService";
import GroupCard from "@/components/group/GroupCard";
import GroupPasswordModal from "@/components/group/GroupPasswordModal";
import SkeletonCard from "@/components/ui/SkeletonCard";

export default function GroupsPage() {
  const router = useRouter();
  const { myGroups, activeGroup, isAdmin, isLoading, handleJoinGroup, switchGroup } =
    useGroup();

  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [passwordTarget, setPasswordTarget] = useState<Group | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoadingGroups(true);
      const { data } = await getAllGroups();
      setAllGroups(data);
      setLoadingGroups(false);
    }
    load();
  }, []);

  async function handleGroupClick(group: Group) {
    setJoinError(null);

    // If already member and just switching
    const isJoined = myGroups.some((g) => g.id === group.id);
    if (isJoined) {
      await switchGroup(group.id);
      router.push("/dashboard");
      return;
    }

    // Need to join
    if (group.is_password_protected) {
      setPasswordTarget(group);
      return;
    }

    const { error } = await handleJoinGroup(group.id);
    if (error) {
      setJoinError(error);
    } else {
      router.push("/dashboard");
    }
  }

  async function handlePasswordConfirm(password: string) {
    if (!passwordTarget) return;
    const { error } = await handleJoinGroup(passwordTarget.id, password);
    if (error) {
      // Re-throw so modal can show it
      throw new Error(error);
    }
    setPasswordTarget(null);
    router.push("/dashboard");
  }

  const myGroupIds = new Set(myGroups.map((g) => g.id));

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <div
        className="relative overflow-hidden px-4 pt-14 pb-6"
        style={{
          background: "linear-gradient(160deg, #1E293B 0%, #0F172A 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-[#1D4ED8]/8 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#1D4ED8]/20 flex items-center justify-center">
                <Users size={16} className="text-[#3B82F6]" />
              </div>
              <motion.h1
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[#F1F5F9] text-xl font-bold font-display"
              >
                Escolha seu grupo
              </motion.h1>
            </div>
            <p className="text-[#64748B] text-sm">
              Entre em um grupo para ver o histórico compartilhado
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => router.push("/admin")}
              className="w-9 h-9 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/25 flex items-center justify-center text-[#F59E0B] hover:bg-[#F59E0B]/25 transition-colors"
              title="Painel Admin"
            >
              <Settings size={17} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Error */}
        {joinError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-4 py-3"
          >
            <p className="text-[#EF4444] text-sm">{joinError}</p>
          </motion.div>
        )}

        {/* My groups section */}
        {!isLoading && myGroups.length > 0 && (
          <section>
            <h2 className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide mb-3">
              Meus grupos
            </h2>
            <div className="space-y-3">
              {myGroups.map((group, i) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isJoined
                  isActive={activeGroup?.id === group.id}
                  onJoin={handleGroupClick}
                  delay={i * 0.05}
                />
              ))}
            </div>
          </section>
        )}

        {/* All groups section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide">
              {myGroups.length > 0 ? "Outros grupos" : "Grupos disponíveis"}
            </h2>
            <button
              onClick={async () => {
                setLoadingGroups(true);
                const { data } = await getAllGroups();
                setAllGroups(data);
                setLoadingGroups(false);
              }}
              className="text-[#475569] hover:text-[#64748B] transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {loadingGroups ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <SkeletonCard key={i} height="110px" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {allGroups
                .filter((g) => !myGroupIds.has(g.id))
                .map((group, i) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    isJoined={false}
                    isActive={false}
                    onJoin={handleGroupClick}
                    delay={i * 0.05}
                  />
                ))}

              {allGroups.filter((g) => !myGroupIds.has(g.id)).length === 0 &&
                !loadingGroups && (
                  <div className="text-center py-10">
                    <span className="text-4xl mb-3 block">⚽</span>
                    <p className="text-[#64748B] text-sm">
                      {myGroups.length > 0
                        ? "Você já está em todos os grupos disponíveis!"
                        : "Nenhum grupo disponível ainda."}
                    </p>
                    {isAdmin && (
                      <button
                        onClick={() => router.push("/admin")}
                        className="mt-4 text-[#3B82F6] text-sm font-semibold hover:text-[#60A5FA] transition-colors"
                      >
                        + Criar um grupo no painel admin
                      </button>
                    )}
                  </div>
                )}
            </div>
          )}
        </section>
      </div>

      {/* Password modal */}
      <GroupPasswordModal
        group={passwordTarget}
        onClose={() => setPasswordTarget(null)}
        onConfirm={handlePasswordConfirm}
      />
    </div>
  );
}

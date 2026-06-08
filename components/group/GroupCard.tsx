"use client";

import { motion } from "framer-motion";
import { Lock, Users, Globe, ArrowRight, CheckCircle } from "lucide-react";
import { Group } from "@/services/groupService";

interface GroupCardProps {
  group: Group;
  isJoined: boolean;
  isActive: boolean;
  onJoin: (group: Group) => void;
  delay?: number;
}

export default function GroupCard({
  group,
  isJoined,
  isActive,
  onJoin,
  delay = 0,
}: GroupCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 26 }}
      className={`relative rounded-2xl border overflow-hidden transition-colors ${
        isActive
          ? "border-[#3B82F6]/60 bg-[#1D4ED8]/10"
          : "border-[#334155]/60 bg-[#1E293B]"
      }`}
    >
      {/* Active badge */}
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#3B82F6]/20 border border-[#3B82F6]/40 rounded-full px-2 py-0.5">
          <CheckCircle size={10} className="text-[#3B82F6]" />
          <span className="text-[#3B82F6] text-[10px] font-bold">Ativo</span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{
              background: isActive
                ? "rgba(29, 78, 216, 0.25)"
                : "rgba(51, 65, 85, 0.6)",
            }}
          >
            {group.emoji ?? "⚽"}
          </div>
          <div className="min-w-0 flex-1 pr-12">
            <p className="text-[#F1F5F9] font-bold text-base leading-tight truncate">
              {group.name}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {group.is_password_protected ? (
                <span className="flex items-center gap-1 text-[#F59E0B] text-xs font-medium">
                  <Lock size={10} />
                  Privado
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#22C55E] text-xs font-medium">
                  <Globe size={10} />
                  Aberto
                </span>
              )}
              <span className="flex items-center gap-1 text-[#64748B] text-xs">
                <Users size={10} />
                {group.member_count}{" "}
                {group.member_count === 1 ? "membro" : "membros"}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {group.description && (
          <p className="text-[#64748B] text-xs mb-3 line-clamp-2 leading-relaxed">
            {group.description}
          </p>
        )}

        {/* Action */}
        <button
          onClick={() => onJoin(group)}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all min-h-[44px] ${
            isActive
              ? "bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/40 hover:bg-[#3B82F6]/30"
              : isJoined
              ? "bg-[#1E40AF]/20 text-[#93C5FD] border border-[#1E40AF]/30 hover:bg-[#1E40AF]/30"
              : "bg-[#1D4ED8] text-white hover:bg-[#1E40AF] active:scale-[0.98]"
          }`}
        >
          {isActive ? (
            "Grupo ativo"
          ) : isJoined ? (
            <>
              Alternar para este grupo
              <ArrowRight size={14} />
            </>
          ) : (
            <>
              {group.is_password_protected ? (
                <>
                  <Lock size={13} />
                  Entrar com senha
                </>
              ) : (
                <>
                  Entrar no grupo
                  <ArrowRight size={14} />
                </>
              )}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

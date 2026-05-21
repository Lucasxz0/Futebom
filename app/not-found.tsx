"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center px-6 text-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Animated ball */}
      <motion.div
        animate={{ y: [0, -18, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="text-[6rem] mb-2 select-none"
        aria-hidden
      >
        ⚽
      </motion.div>

      {/* Shadow */}
      <motion.div
        animate={{ scaleX: [1, 0.65, 1], opacity: [0.35, 0.15, 0.35] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="w-20 h-3 rounded-full bg-[#1D4ED8]/40 blur-sm mb-8"
      />

      {/* 404 */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-[#1D4ED8] text-7xl font-black font-display leading-none mb-2"
      >
        404
      </motion.h1>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="text-[#F1F5F9] text-2xl font-bold font-display mb-3"
      >
        Fora de campo!
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.26 }}
        className="text-[#64748B] text-sm max-w-xs mb-10"
      >
        Essa página saiu pela linha de fundo. Volte para o jogo e tente outra rota.
      </motion.p>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34 }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center justify-center gap-2 bg-[#1D4ED8] text-white font-bold rounded-2xl py-3.5 min-h-[52px] hover:bg-[#1E40AF] transition-colors"
          style={{ boxShadow: "0 4px 16px rgba(29,78,216,0.4)" }}
        >
          <Home size={18} />
          Ir para o Dashboard
        </button>

        <button
          onClick={() => router.back()}
          className="flex items-center justify-center gap-2 bg-[#1E293B] border border-[#334155] text-[#94A3B8] font-semibold rounded-2xl py-3.5 min-h-[52px] hover:border-[#475569] transition-colors"
        >
          <ArrowLeft size={18} />
          Voltar
        </button>
      </motion.div>
    </div>
  );
}

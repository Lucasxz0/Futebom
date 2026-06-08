"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, X, Eye, EyeOff } from "lucide-react";
import Button from "@/components/ui/Button";
import { Group } from "@/services/groupService";

interface GroupPasswordModalProps {
  group: Group | null;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}

export default function GroupPasswordModal({
  group,
  onClose,
  onConfirm,
}: GroupPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = !!group;

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(password.trim());
    } catch {
      setError("Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#1E293B] border border-[#334155] rounded-t-3xl p-6 pb-10 mx-0 md:mx-auto md:max-w-md md:bottom-1/2 md:translate-y-1/2 md:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 flex items-center justify-center">
                  <Lock size={18} className="text-[#F59E0B]" />
                </div>
                <div>
                  <p className="text-[#F1F5F9] font-bold leading-tight">
                    {group?.emoji} {group?.name}
                  </p>
                  <p className="text-[#64748B] text-xs">Grupo privado</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#64748B] hover:text-[#94A3B8] hover:bg-[#334155] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide block mb-2">
                  Senha do grupo
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Digite a senha..."
                    className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 pr-12 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] text-sm"
                    style={{ minHeight: "48px" }}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8] transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[#EF4444] text-xs mt-1.5"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={loading}
                disabled={!password.trim()}
              >
                <Lock size={14} />
                Entrar no grupo
              </Button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

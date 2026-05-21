"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  UserCheck,
  UserPlus,
  Pencil,
  Trash2,
  X,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";
import { Player, PlayerType } from "@/services/playerService";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import SkeletonCard from "@/components/ui/SkeletonCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean;
  mode: "add" | "edit";
  player?: Player;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  type,
  onAdd,
}: {
  type: "permanent" | "casual";
  onAdd: () => void;
}) {
  const isPermanent = type === "permanent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-8 px-4 rounded-2xl border border-dashed border-[#334155]"
    >
      {isPermanent ? (
        <ShieldCheck size={36} className="text-[#334155] mb-3" />
      ) : (
        <Zap size={36} className="text-[#334155] mb-3" />
      )}
      <p className="text-[#64748B] text-sm text-center">
        {isPermanent
          ? "Nenhum jogador fixo ainda."
          : "Nenhum jogador convidado ainda."}
      </p>
      <button
        onClick={onAdd}
        className="mt-3 text-[#3B82F6] text-sm font-semibold hover:text-[#60A5FA] transition-colors min-h-[44px] flex items-center gap-1"
      >
        <Plus size={16} /> Adicionar
      </button>
    </motion.div>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────

function PlayerCard({
  player,
  onEdit,
  onDelete,
}: {
  player: Player;
  onEdit: (p: Player) => void;
  onDelete: (p: Player) => void;
}) {
  const isPermanent = player.type === "permanent";
  const [actionsOpen, setActionsOpen] = useState(false);

  const initials = player.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="relative"
    >
      <div
        className="flex items-center gap-3 bg-[#1E293B] rounded-2xl px-4 py-3 border border-[#334155]/60 active:scale-[0.99] transition-transform"
        style={{ minHeight: "72px" }}
      >
        {/* Avatar */}
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold font-display text-sm ${isPermanent
            ? "bg-[#1D4ED8]/30 text-[#3B82F6]"
            : "bg-[#334155] text-[#94A3B8]"
            }`}
        >
          {initials}
        </div>

        {/* Name + badge */}
        <div className="flex-1 min-w-0">
          <p className="text-[#F1F5F9] font-semibold truncate">{player.name}</p>
          <span
            className={`inline-flex items-center gap-1 text-xs mt-0.5 ${isPermanent ? "text-[#3B82F6]" : "text-[#64748B]"
              }`}
          >
            {isPermanent ? (
              <>
                <ShieldCheck size={11} /> Fixo
              </>
            ) : (
              <>
                <Zap size={11} /> Avulso
              </>
            )}
          </span>
        </div>

        {/* Actions toggle */}
        <button
          onClick={() => setActionsOpen((v) => !v)}
          className="text-[#64748B] hover:text-[#F1F5F9] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Opções do jogador"
        >
          <ChevronRight
            size={18}
            className={`transition-transform duration-200 ${actionsOpen ? "rotate-90" : ""}`}
          />
        </button>
      </div>

      {/* Inline action buttons */}
      <AnimatePresence>
        {actionsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 px-4 pt-2 pb-1">
              <button
                onClick={() => {
                  setActionsOpen(false);
                  onEdit(player);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1D4ED8]/20 hover:bg-[#1D4ED8]/40 border border-[#1D4ED8]/40 text-[#3B82F6] rounded-xl py-2.5 text-sm font-semibold transition-colors min-h-[44px]"
              >
                <Pencil size={15} /> Editar
              </button>
              <button
                onClick={() => {
                  setActionsOpen(false);
                  onDelete(player);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 text-[#EF4444] rounded-xl py-2.5 text-sm font-semibold transition-colors min-h-[44px]"
              >
                <Trash2 size={15} /> Remover
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Add / Edit Modal (Bottom Sheet on mobile) ────────────────────────────────

function PlayerModal({
  modal,
  onClose,
  onSave,
}: {
  modal: ModalState;
  onClose: () => void;
  onSave: (
    name: string,
    type: PlayerType
  ) => Promise<{ error: string | null }>;
}) {
  const [name, setName] = useState(modal.player?.name ?? "");
  const [type, setType] = useState<PlayerType>(
    modal.player?.type ?? "permanent"
  );
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input when modal opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError("Digite o nome do jogador.");
      return;
    }
    setSaving(true);
    setFieldError(null);
    const { error } = await onSave(trimmed, type);
    setSaving(false);
    if (error) {
      setFieldError(error);
    } else {
      onClose();
    }
  }

  const isEdit = modal.mode === "edit";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        className="w-full max-w-md bg-[#1E293B] rounded-t-3xl px-5 pt-5 pb-8 border-t border-[#334155]"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 bg-[#334155] rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[#F1F5F9] text-xl font-bold font-display">
            {isEdit ? "Editar Jogador" : "Novo Jogador"}
          </h2>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F1F5F9] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name field */}
          <div>
            <label
              htmlFor="player-name"
              className="block text-[#94A3B8] text-sm mb-2 font-medium"
            >
              Nome do jogador
            </label>
            <input
              ref={inputRef}
              id="player-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldError(null);
              }}
              placeholder="Ex: João Silva"
              maxLength={50}
              className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors text-base"
              style={{ minHeight: "52px" }}
            />
            {fieldError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[#EF4444] text-sm mt-2"
              >
                {fieldError}
              </motion.p>
            )}
          </div>

          {/* Type toggle */}
          <div>
            <p className="text-[#94A3B8] text-sm mb-2 font-medium">Tipo</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("permanent")}
                className={`flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold border transition-all min-h-[52px] ${type === "permanent"
                  ? "bg-[#1D4ED8] border-[#1D4ED8] text-white shadow-lg"
                  : "bg-[#0F172A] border-[#334155] text-[#64748B] hover:border-[#475569]"
                  }`}
              >
                <ShieldCheck size={16} />
                Fixo
              </button>
              <button
                type="button"
                onClick={() => setType("casual")}
                className={`flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold border transition-all min-h-[52px] ${type === "casual"
                  ? "bg-[#475569] border-[#475569] text-white shadow-lg"
                  : "bg-[#0F172A] border-[#334155] text-[#64748B] hover:border-[#475569]"
                  }`}
              >
                <Zap size={16} />
                Avulso
              </button>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={saving}
          >
            {isEdit ? "Salvar alterações" : "Adicionar jogador"}
          </Button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Delete Confirm Dialog ─────────────────────────────────────────────────────

function DeleteConfirmDialog({
  player,
  onConfirm,
  onCancel,
  loading,
}: {
  player: Player;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 35 }}
        className="w-full max-w-sm bg-[#1E293B] rounded-3xl p-6 border border-[#334155]"
      >
        <div className="w-14 h-14 bg-[#EF4444]/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Trash2 size={28} className="text-[#EF4444]" />
        </div>
        <h3 className="text-[#F1F5F9] text-lg font-bold text-center mb-2">
          Remover jogador?
        </h3>
        <p className="text-[#64748B] text-sm text-center mb-6">
          <span className="text-[#94A3B8] font-semibold">{player.name}</span> será
          removido permanentemente da sua lista.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-[#0F172A] border border-[#334155] text-[#94A3B8] rounded-xl py-3 text-sm font-semibold min-h-[48px] hover:border-[#475569] transition-colors"
          >
            Cancelar
          </button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={onConfirm}
            loading={loading}
          >
            Remover
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      {icon}
      <span className="text-[#94A3B8] text-sm font-semibold uppercase tracking-wide">
        {title}
      </span>
      <span className="ml-auto bg-[#1E293B] border border-[#334155] text-[#64748B] text-xs px-2 py-0.5 rounded-full font-mono">
        {count}
      </span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PlayersPage() {
  const { permanentPlayers, casualPlayers, loading, error, addPlayer, editPlayer, removePlayer, refresh } =
    usePlayers();
  const { showToast } = useToast();

  const [modal, setModal] = useState<ModalState>({ open: false, mode: "add" });
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openAdd(defaultType?: PlayerType) {
    setModal({ open: true, mode: "add", player: defaultType ? { type: defaultType } as Player : undefined });
  }

  function openEdit(player: Player) {
    setModal({ open: true, mode: "edit", player });
  }

  function closeModal() {
    setModal({ open: false, mode: "add" });
  }

  async function handleSave(
    name: string,
    type: PlayerType
  ): Promise<{ error: string | null }> {
    if (modal.mode === "add") {
      const result = await addPlayer({ name, type });
      if (!result.error) showToast(`${name} adicionado!`, "success");
      return result;
    } else {
      const result = await editPlayer(modal.player!.id, { name, type });
      if (!result.error) showToast(`${name} atualizado!`, "success");
      return result;
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await removePlayer(deleteTarget.id);
    setDeleting(false);
    if (error) {
      showToast(error, "error");
    } else {
      showToast(`${deleteTarget.name} removido.`, "info");
    }
    setDeleteTarget(null);
  }

  const totalPlayers = permanentPlayers.length + casualPlayers.length;

  return (
    <>
      <div className="min-h-screen bg-[#0F172A] px-4 pt-14 pb-28">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-4 pb-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={24} className="text-[#3B82F6]" />
              <h1 className="text-[#F1F5F9] text-2xl font-bold font-display">
                Jogadores
              </h1>
              {!loading && (
                <span className="bg-[#1D4ED8]/20 border border-[#1D4ED8]/40 text-[#3B82F6] text-xs px-2 py-0.5 rounded-full font-mono ml-1">
                  {totalPlayers}
                </span>
              )}
            </div>

            {/* FAB-style add button */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => openAdd()}
              id="add-player-btn"
              className="flex items-center gap-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px] shadow-lg"
            >
              <Plus size={18} />
              Adicionar
            </motion.button>
          </div>
          <p className="text-[#64748B] text-sm mt-1">
            Seus jogadores fixos e convidados
          </p>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-2xl px-4 py-3 mb-5"
          >
            <p className="text-[#EF4444] text-sm">{error}</p>
            <button
              onClick={refresh}
              className="text-[#EF4444] text-xs underline mt-1 min-h-[36px]"
            >
              Tentar novamente
            </button>
          </motion.div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} height="72px" />
            ))}
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <div className="space-y-7">
            {/* Permanent players */}
            <section>
              <SectionHeader
                icon={<UserCheck size={15} className="text-[#3B82F6]" />}
                title="Fixos"
                count={permanentPlayers.length}
              />
              {permanentPlayers.length === 0 ? (
                <EmptyState type="permanent" onAdd={() => openAdd("permanent")} />
              ) : (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {permanentPlayers.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>

            {/* Casual players */}
            <section>
              <SectionHeader
                icon={<UserPlus size={15} className="text-[#64748B]" />}
                title="Convidados"
                count={casualPlayers.length}
              />
              {casualPlayers.length === 0 ? (
                <EmptyState type="casual" onAdd={() => openAdd("casual")} />
              ) : (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {casualPlayers.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>

            {/* Empty all state */}
            {totalPlayers === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center pt-12 pb-6"
              >
                <div className="w-20 h-20 bg-[#1E293B] rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Users size={40} className="text-[#334155]" />
                </div>
                <h3 className="text-[#94A3B8] font-semibold text-lg mb-2">
                  Nenhum jogador ainda
                </h3>
                <p className="text-[#64748B] text-sm mb-6 max-w-xs mx-auto">
                  Adicione os jogadores da sua pelada para usar nas partidas.
                </p>
                <Button variant="primary" onClick={() => openAdd()} className="mx-auto">
                  <Plus size={18} className="mr-1" />
                  Adicionar primeiro jogador
                </Button>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Modal — Add / Edit */}
      <AnimatePresence>
        {modal.open && (
          <PlayerModal modal={modal} onClose={closeModal} onSave={handleSave} />
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmDialog
            player={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            loading={deleting}
          />
        )}
      </AnimatePresence>
    </>
  );
}

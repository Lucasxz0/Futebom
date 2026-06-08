"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import Button from "@/components/ui/Button";

export interface GroupFormData {
  name: string;
  emoji: string;
  description?: string | null;
  password?: string;
  is_password_protected?: boolean;
}

interface GroupFormProps {
  initial?: Partial<GroupFormData>;
  onSave: (data: {
    name: string;
    emoji: string;
    description: string;
    password: string;
  }) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}

export default function GroupForm({ initial, onSave, onCancel, saveLabel }: GroupFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "⚽");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const EMOJIS = ["⚽", "🏆", "🥅", "🥇", "🔥", "⚡", "🎯", "🦁", "🐺", "👑"];

  async function handleSave() {
    if (!name.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), emoji, description, password });
    } catch (e: any) {
      setError(e.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Emoji picker */}
      <div>
        <label className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide block mb-2">
          Emoji do grupo
        </label>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                emoji === e
                  ? "bg-[#1D4ED8]/30 border-2 border-[#3B82F6]"
                  : "bg-[#0F172A] border border-[#334155] hover:border-[#475569]"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide block mb-2">
          Nome do grupo *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Pelada da Quinta"
          maxLength={50}
          className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] text-sm"
          style={{ minHeight: "48px" }}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide block mb-2">
          Descrição (opcional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Fut semanal toda quinta às 19h"
          maxLength={200}
          rows={2}
          className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] text-sm resize-none"
        />
      </div>

      {/* Password */}
      <div>
        <label className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide block mb-2">
          Senha (deixe vazio para grupo aberto)
        </label>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={initial?.is_password_protected ? "••••••• (não alterada)" : "Opcional"}
          maxLength={30}
          className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] text-sm"
          style={{ minHeight: "48px" }}
        />
        <p className="text-[#475569] text-xs mt-1">
          {password
            ? "✅ Grupo privado — usuários precisarão digitar a senha"
            : "🌐 Grupo aberto — qualquer um pode entrar"}
        </p>
      </div>

      {error && <p className="text-[#EF4444] text-sm">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-2 border border-[#334155] rounded-xl py-3 text-[#64748B] text-sm font-bold hover:border-[#475569] min-h-[48px] transition-colors"
        >
          <X size={15} />
          Cancelar
        </button>
        <Button variant="primary" className="flex-1" loading={loading} onClick={handleSave}>
          <Check size={15} />
          {saveLabel || (initial ? "Salvar" : "Criar grupo")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Users,
  Lock,
  Globe,
  X,
  Check,
  Shield,
  ShieldOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Button from "@/components/ui/Button";
import SkeletonCard from "@/components/ui/SkeletonCard";
import {
  AdminGroup,
  GroupMemberDetail,
  getAllGroupsAdmin,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  removeMember,
  getAllAdmins,
  grantAdmin,
  revokeAdmin,
  AppAdmin,
} from "@/services/adminService";
import { useGroup } from "@/contexts/GroupContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

// ─── Group Form ───────────────────────────────────────────────────────────────

import GroupForm from "@/components/group/GroupForm";

// ─── Group Row ────────────────────────────────────────────────────────────────

interface GroupRowProps {
  group: AdminGroup;
  onEdit: (group: AdminGroup) => void;
  onDelete: (group: AdminGroup) => void;
}

function GroupRow({ group, onEdit, onDelete }: GroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<GroupMemberDetail[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadMembers() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    setLoadingMembers(true);
    const { data } = await getGroupMembers(group.id);
    setMembers(data);
    setLoadingMembers(false);
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId);
    await removeMember(group.id, userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    setRemovingId(null);
  }

  return (
    <div className="rounded-2xl border border-[#334155]/60 bg-[#1E293B] overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-[#334155]/60 flex items-center justify-center text-xl shrink-0">
          {group.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#F1F5F9] font-bold truncate">{group.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {group.is_password_protected ? (
              <span className="flex items-center gap-1 text-[#F59E0B] text-xs">
                <Lock size={9} /> Privado
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#22C55E] text-xs">
                <Globe size={9} /> Aberto
              </span>
            )}
            <span className="flex items-center gap-1 text-[#64748B] text-xs">
              <Users size={9} />
              {group.member_count} membros
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={loadMembers}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#94A3B8] hover:bg-[#334155] transition-colors"
            title="Ver membros"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button
            onClick={() => onEdit(group)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#3B82F6] hover:bg-[#1D4ED8]/10 transition-colors"
            title="Editar"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => onDelete(group)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
            title="Excluir"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Members list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[#334155]/60"
          >
            <div className="p-4 space-y-2">
              {loadingMembers ? (
                <p className="text-[#64748B] text-xs text-center py-2">
                  Carregando...
                </p>
              ) : members.length === 0 ? (
                <p className="text-[#64748B] text-xs text-center py-2">
                  Nenhum membro ainda
                </p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-2 py-1.5"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#334155] flex items-center justify-center text-xs font-bold text-[#94A3B8]">
                      {shortId(m.user_id)[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#94A3B8] text-xs font-mono truncate">
                        {shortId(m.user_id)}
                      </p>
                      <p className="text-[#475569] text-[10px]">{m.role}</p>
                    </div>
                    <button
                      onClick={() => handleRemove(m.user_id)}
                      disabled={removingId === m.user_id}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#475569] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors disabled:opacity-50"
                      title="Remover membro"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { refresh: refreshContext } = useGroup();

  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [admins, setAdmins] = useState<AppAdmin[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminGroup | null>(null);
  const [newAdminId, setNewAdminId] = useState("");
  const [grantingAdmin, setGrantingAdmin] = useState(false);
  const [adminActionError, setAdminActionError] = useState<string | null>(null);

  const [tab, setTab] = useState<"groups" | "admins">("groups");

  const loadAll = useCallback(async () => {
    setLoadingGroups(true);
    setLoadingAdmins(true);
    const [{ data: g }, { data: a }] = await Promise.all([
      getAllGroupsAdmin(),
      getAllAdmins(),
    ]);
    setGroups(g);
    setAdmins(a);
    setLoadingGroups(false);
    setLoadingAdmins(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreate(data: {
    name: string;
    emoji: string;
    description: string;
    password: string;
  }) {
    const { error } = await createGroup({
      name: data.name,
      emoji: data.emoji,
      description: data.description,
      password: data.password || undefined,
    });
    if (error) throw new Error(error);
    setShowCreateForm(false);
    await loadAll();
    await refreshContext();
  }

  async function handleEdit(
    group: AdminGroup,
    data: {
      name: string;
      emoji: string;
      description: string;
      password: string;
    }
  ) {
    const { error } = await updateGroup(group.id, {
      name: data.name,
      emoji: data.emoji,
      description: data.description,
      password: data.password || undefined,
    });
    if (error) throw new Error(error);
    setEditTarget(null);
    await loadAll();
    await refreshContext();
  }

  async function handleDelete(group: AdminGroup) {
    if (!confirm(`Excluir grupo "${group.name}"? Esta ação é irreversível.`))
      return;
    const { error } = await deleteGroup(group.id);
    if (!error) {
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      await refreshContext();
    }
  }

  async function handleGrantAdmin() {
    if (!newAdminId.trim()) return;
    setGrantingAdmin(true);
    setAdminActionError(null);
    const { error } = await grantAdmin(newAdminId.trim());
    setGrantingAdmin(false);
    if (error) {
      setAdminActionError(error);
    } else {
      setNewAdminId("");
      await loadAll();
    }
  }

  async function handleRevokeAdmin(userId: string) {
    if (!confirm("Remover este admin?")) return;
    const { error } = await revokeAdmin(userId);
    if (!error) setAdmins((prev) => prev.filter((a) => a.user_id !== userId));
  }

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <div
        className="relative overflow-hidden px-4 pt-12 pb-5"
        style={{
          background: "linear-gradient(160deg, #1E293B 0%, #0F172A 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-[#334155]/50 flex items-center justify-center text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#334155] transition-colors"
          >
            <ArrowLeft size={17} />
          </button>
          <div>
            <h1 className="text-[#F1F5F9] font-bold text-lg font-display flex items-center gap-2">
              ⚙️ Painel Admin
            </h1>
            <p className="text-[#64748B] text-xs">Gerencie grupos e admins</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 relative z-10">
          {(["groups", "admins"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                tab === t
                  ? "bg-[#1D4ED8] text-white"
                  : "bg-[#334155]/40 text-[#64748B] hover:text-[#94A3B8]"
              }`}
            >
              {t === "groups" ? "🏟️ Grupos" : "🛡️ Admins"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* GROUPS TAB */}
        {tab === "groups" && (
          <>
            {/* Create group button */}
            {!showCreateForm && !editTarget && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#334155] rounded-2xl py-4 text-[#64748B] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors font-semibold text-sm"
              >
                <Plus size={18} />
                Criar novo grupo
              </motion.button>
            )}

            {/* Create form */}
            <AnimatePresence>
              {showCreateForm && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="rounded-2xl border border-[#3B82F6]/40 bg-[#1E293B] p-5"
                >
                  <p className="text-[#F1F5F9] font-bold mb-4 flex items-center gap-2">
                    <Plus size={16} className="text-[#3B82F6]" />
                    Novo grupo
                  </p>
                  <GroupForm
                    onSave={handleCreate}
                    onCancel={() => setShowCreateForm(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Edit form */}
            <AnimatePresence>
              {editTarget && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="rounded-2xl border border-[#F59E0B]/40 bg-[#1E293B] p-5"
                >
                  <p className="text-[#F1F5F9] font-bold mb-4 flex items-center gap-2">
                    <Edit2 size={16} className="text-[#F59E0B]" />
                    Editar: {editTarget.name}
                  </p>
                  <GroupForm
                    initial={editTarget}
                    onSave={(data) => handleEdit(editTarget, data)}
                    onCancel={() => setEditTarget(null)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Groups list */}
            {loadingGroups ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <SkeletonCard key={i} height="80px" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-10">
                <span className="text-4xl mb-3 block">🏟️</span>
                <p className="text-[#64748B] text-sm">
                  Nenhum grupo criado ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((g) => (
                  <GroupRow
                    key={g.id}
                    group={g}
                    onEdit={setEditTarget}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ADMINS TAB */}
        {tab === "admins" && (
          <>
            {/* Grant admin form */}
            <div className="rounded-2xl border border-[#334155]/60 bg-[#1E293B] p-4">
              <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
                <Shield size={12} />
                Adicionar admin por User ID
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAdminId}
                  onChange={(e) => {
                    setNewAdminId(e.target.value);
                    setAdminActionError(null);
                  }}
                  placeholder="UUID do usuário..."
                  className="flex-1 bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-2.5 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#1D4ED8] text-sm"
                  style={{ minHeight: "44px" }}
                />
                <Button
                  variant="primary"
                  loading={grantingAdmin}
                  onClick={handleGrantAdmin}
                  disabled={!newAdminId.trim()}
                  className="shrink-0"
                >
                  <Shield size={14} />
                  Promover
                </Button>
              </div>
              {adminActionError && (
                <p className="text-[#EF4444] text-xs mt-2">{adminActionError}</p>
              )}
              <p className="text-[#475569] text-xs mt-2">
                Encontre o UUID no Supabase → Authentication → Users.
              </p>
            </div>

            {/* Admins list */}
            {loadingAdmins ? (
              <SkeletonCard height="80px" />
            ) : admins.length === 0 ? (
              <p className="text-[#64748B] text-sm text-center py-6">
                Nenhum admin registrado.
              </p>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div
                    key={admin.user_id}
                    className="flex items-center gap-3 rounded-2xl border border-[#334155]/60 bg-[#1E293B] px-4 py-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/15 flex items-center justify-center">
                      <Shield size={15} className="text-[#F59E0B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#94A3B8] text-xs font-mono truncate">
                        {admin.user_id}
                      </p>
                      <p className="text-[#475569] text-[10px]">
                        Admin desde{" "}
                        {new Date(admin.added_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevokeAdmin(admin.user_id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#475569] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                      title="Remover admin"
                    >
                      <ShieldOff size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

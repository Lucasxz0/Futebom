"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
import { useGroup } from "@/contexts/GroupContext";
import GroupForm, { GroupFormData } from "@/components/group/GroupForm";
import { updateGroup } from "@/services/adminService";
import SkeletonCard from "@/components/ui/SkeletonCard";

export default function GroupSettingsPage() {
  const router = useRouter();
  const { activeGroup, isGroupAdmin, isLoading, refresh } = useGroup();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isGroupAdmin) {
      router.replace("/profile");
    }
  }, [isLoading, isGroupAdmin, router]);

  if (isLoading || !activeGroup || !isGroupAdmin) {
    return (
      <div className="min-h-screen bg-[#0F172A] px-4 pt-14">
        <SkeletonCard height="200px" />
      </div>
    );
  }

  async function handleSave(data: {
    name: string;
    emoji: string;
    description: string;
    password?: string;
  }) {
    setLoading(true);
    try {
      const { error } = await updateGroup(activeGroup!.id, {
        name: data.name,
        emoji: data.emoji,
        description: data.description,
        password: data.password || undefined,
      });

      if (error) throw new Error(error);

      await refresh();
      router.push("/profile");
    } finally {
      setLoading(false);
    }
  }

  const initialData: Partial<GroupFormData> = {
    name: activeGroup.name,
    emoji: activeGroup.emoji,
    description: activeGroup.description || "",
    is_password_protected: activeGroup.is_password_protected,
  };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-10">
      <div
        className="relative overflow-hidden px-4 pt-14 pb-6"
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
              <Settings size={18} className="text-[#3B82F6]" />
              Configurações do Grupo
            </h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="bg-[#1E293B] border border-[#334155]/60 rounded-2xl p-5">
          <GroupForm
            initial={initialData}
            onSave={handleSave}
            onCancel={() => router.back()}
            saveLabel="Salvar Alterações"
          />
        </div>
      </div>
    </div>
  );
}

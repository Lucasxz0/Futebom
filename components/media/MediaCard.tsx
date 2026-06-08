"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Play, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { MediaPost, deleteMedia } from "@/services/mediaService";
import { createClient } from "@/lib/supabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MediaCardProps {
  post: MediaPost;
  currentUserId?: string | null;
  onDeleted: (postId: string) => void;
  index?: number;
}

export default function MediaCard({
  post,
  currentUserId,
  onDeleted,
  index = 0,
}: MediaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const isOwner = currentUserId === post.author_id;
  const initials = (post.author_name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  async function handleDelete() {
    setDeleting(true);
    const { error } = await deleteMedia(post.id, post.storage_path);
    setDeleting(false);
    if (!error) {
      onDeleted(post.id);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 300, damping: 28 }}
      className="bg-[#1E293B] rounded-2xl border border-[#334155]/60 overflow-hidden"
    >
      {/* Author header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#7C3AED] flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#F1F5F9] text-sm font-semibold truncate">
            {post.author_name ?? "Jogador"}
          </p>
          <div className="flex items-center gap-1.5 text-[#64748B] text-xs">
            <Calendar size={10} />
            {formatRelativeDate(post.created_at)}
          </div>
        </div>

        {/* Delete button (owner only) */}
        {isOwner && (
          <div className="relative">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[#475569] hover:text-[#EF4444] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <Trash2 size={15} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[#64748B] text-xs font-semibold hover:text-[#94A3B8] min-h-[36px] px-2"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-white bg-[#EF4444] text-xs font-bold rounded-lg px-3 min-h-[36px] hover:bg-[#DC2626] transition-colors flex items-center gap-1"
                >
                  {deleting ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Apagar"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Media */}
      <div className="relative bg-[#0F172A]">
        {post.media_type === "video" ? (
          <div className="relative">
            <video
              src={post.url}
              className="w-full max-h-80 object-contain"
              controls={videoPlaying}
              onClick={() => setVideoPlaying(true)}
            />
            {!videoPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <button
                  onClick={() => setVideoPlaying(true)}
                  className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <Play size={24} className="text-white ml-1" />
                </button>
              </div>
            )}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.url}
            alt={post.caption ?? "Foto da pelada"}
            className="w-full max-h-80 object-contain"
            loading="lazy"
          />
        )}
      </div>

      {/* Caption */}
      {post.caption && (
        <div className="px-4 py-3 border-t border-[#334155]/40">
          <p
            className={`text-[#CBD5E1] text-sm leading-relaxed ${
              !expanded && post.caption.length > 120 ? "line-clamp-2" : ""
            }`}
          >
            {post.caption}
          </p>
          {post.caption.length > 120 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[#3B82F6] text-xs font-semibold mt-1 flex items-center gap-0.5 hover:text-[#60A5FA]"
            >
              {expanded ? (
                <>
                  <ChevronUp size={12} /> ver menos
                </>
              ) : (
                <>
                  <ChevronDown size={12} /> ver mais
                </>
              )}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Plus, RefreshCw, Users, Lock } from "lucide-react";
import { getGroupMedia, MediaPost } from "@/services/mediaService";
import { getRecentMatches } from "@/services/historyService";
import { useGroup } from "@/contexts/GroupContext";
import { createClient } from "@/lib/supabase";
import MediaCard from "@/components/media/MediaCard";
import MediaUploadSheet from "@/components/media/MediaUploadSheet";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MediaPage() {
  const { activeGroup, isLoading: groupLoading } = useGroup();
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recentMatches, setRecentMatches] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const loadFeed = useCallback(async (reset = false) => {
    if (reset) setLoading(true);
    const cursor = reset ? undefined : posts[posts.length - 1]?.created_at;
    const { data, error } = await getGroupMedia({ limit: 15, before: cursor });
    if (!error && data) {
      setPosts((prev) => (reset ? data : [...prev, ...data]));
      setHasMore(data.length === 15);
    }
    setLoading(false);
    setLoadingMore(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!groupLoading && activeGroup) {
      loadFeed(true);
      // Load recent matches for linking
      getRecentMatches(10).then(({ data }) => {
        setRecentMatches(
          data
            .filter((m) => m.status === "finished")
            .map((m) => ({ id: m.id, name: m.name }))
        );
      });
    } else if (!groupLoading) {
      setLoading(false);
    }
  }, [activeGroup, groupLoading, loadFeed]);

  function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadFeed(false);
  }

  function handlePostUploaded(post: MediaPost) {
    setPosts((prev) => [post, ...prev]);
  }

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  // ── No group state ──────────────────────────────────────────────────────────
  if (!groupLoading && !activeGroup) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-[#1E293B] border border-[#334155] rounded-3xl flex items-center justify-center mb-6">
          <Lock size={36} className="text-[#334155]" />
        </div>
        <h2 className="text-[#F1F5F9] text-xl font-bold mb-2">
          Entre em um grupo
        </h2>
        <p className="text-[#64748B] text-sm max-w-xs">
          Para ver e postar fotos e vídeos, você precisa fazer parte de um grupo. Vá em{" "}
          <span className="text-[#3B82F6] font-semibold">Perfil</span> para criar ou entrar.
        </p>
      </div>
    );
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] px-4 pt-14">
        <div className="flex items-center gap-2 mb-6">
          <Camera size={22} className="text-[#3B82F6]" />
          <h1 className="text-[#F1F5F9] text-2xl font-bold font-display">Fotos</h1>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#1E293B] rounded-2xl border border-[#334155]/60 overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 bg-[#334155]/50 rounded-xl animate-pulse" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 bg-[#334155]/50 rounded-full w-32 animate-pulse" />
                  <div className="h-2 bg-[#334155]/50 rounded-full w-16 animate-pulse" />
                </div>
              </div>
              <div
                className="bg-[#334155]/30 animate-pulse"
                style={{ height: `${180 + i * 40}px` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-10">
      {/* Header */}
      <div className="px-4 pt-14 pb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Camera size={22} className="text-[#3B82F6]" />
            <h1 className="text-[#F1F5F9] text-2xl font-bold font-display">Fotos</h1>
          </div>
          {activeGroup && (
            <div className="flex items-center gap-1 text-[#64748B] text-xs">
              <Users size={11} />
              {activeGroup.name}
            </div>
          )}
        </div>
        <button
          onClick={() => loadFeed(true)}
          className="text-[#64748B] hover:text-[#F1F5F9] min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Atualizar feed"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Feed */}
      <div className="px-4 space-y-4">
        {/* Empty state */}
        {posts.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 bg-[#1E293B] border border-[#334155] rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Camera size={36} className="text-[#334155]" />
            </div>
            <h3 className="text-[#F1F5F9] font-bold font-display text-xl mb-2">
              Nenhuma foto ainda
            </h3>
            <p className="text-[#64748B] text-sm max-w-xs mx-auto mb-6">
              Seja o primeiro a postar um momento da pelada!
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 bg-[#1D4ED8] text-white rounded-xl px-5 py-3 text-sm font-bold shadow-lg"
            >
              <Camera size={16} />
              Postar agora
            </motion.button>
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {posts.map((post, i) => (
            <MediaCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onDeleted={handlePostDeleted}
              index={i}
            />
          ))}
        </AnimatePresence>

        {/* Load more */}
        {hasMore && posts.length > 0 && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full py-3 text-[#64748B] text-sm font-semibold flex items-center justify-center gap-2 hover:text-[#94A3B8] transition-colors"
          >
            {loadingMore ? (
              <span className="w-4 h-4 border-2 border-[#64748B] border-t-transparent rounded-full animate-spin" />
            ) : (
              "Carregar mais"
            )}
          </button>
        )}
      </div>

      {/* FAB — post button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 20 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setShowUpload(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-[#1D4ED8] rounded-2xl shadow-2xl flex items-center justify-center text-white z-40"
        style={{
          boxShadow: "0 8px 32px rgba(29, 78, 216, 0.4)",
        }}
        aria-label="Nova publicação"
      >
        <Plus size={24} />
      </motion.button>

      {/* Upload sheet */}
      <AnimatePresence>
        {showUpload && (
          <MediaUploadSheet
            onClose={() => setShowUpload(false)}
            onUploaded={handlePostUploaded}
            recentMatches={recentMatches}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

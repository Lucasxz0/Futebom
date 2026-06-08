"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Camera,
  Video,
  Image as ImageIcon,
  ChevronDown,
  Check,
  Upload,
} from "lucide-react";
import { uploadMedia } from "@/services/mediaService";
import { MediaPost } from "@/services/mediaService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Match {
  id: string;
  name: string;
}

interface MediaUploadSheetProps {
  onClose: () => void;
  onUploaded: (post: MediaPost) => void;
  recentMatches?: Match[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MediaUploadSheet({
  onClose,
  onUploaded,
  recentMatches = [],
}: MediaUploadSheetProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [showMatchPicker, setShowMatchPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isVideo = file?.type.startsWith("video/") ?? false;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    // Size limit: 50MB for video, 10MB for image
    const maxSize = f.type.startsWith("video/") ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (f.size > maxSize) {
      setError(
        f.type.startsWith("video/")
          ? "Vídeo muito grande. Limite: 50MB."
          : "Imagem muito grande. Limite: 10MB."
      );
      return;
    }

    setFile(f);
    setError(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgress(0);

    const { data, error: err } = await uploadMedia(
      {
        file,
        caption: caption.trim() || undefined,
        matchId: selectedMatchId,
      },
      (pct) => setProgress(pct)
    );

    setUploading(false);
    if (err) {
      setError(err);
    } else if (data) {
      onUploaded(data);
      onClose();
    }
  }

  const selectedMatch = recentMatches.find((m) => m.id === selectedMatchId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="w-full max-w-md bg-[#1E293B] rounded-t-3xl border-t border-[#334155] overflow-hidden"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-[#334155] rounded-full mx-auto mt-4 mb-1" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#334155]/60">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-[#3B82F6]" />
            <h2 className="text-[#F1F5F9] font-bold text-lg">Nova Publicação</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F1F5F9] min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* File picker */}
          {!file ? (
            <label className="flex flex-col items-center justify-center w-full h-48 rounded-2xl border-2 border-dashed border-[#334155] bg-[#0F172A] cursor-pointer hover:border-[#1D4ED8] transition-colors group">
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex gap-3 mb-3">
                <ImageIcon size={28} className="text-[#334155] group-hover:text-[#1D4ED8] transition-colors" />
                <Video size={28} className="text-[#334155] group-hover:text-[#1D4ED8] transition-colors" />
              </div>
              <p className="text-[#64748B] text-sm font-semibold">
                Toque para selecionar foto ou vídeo
              </p>
              <p className="text-[#475569] text-xs mt-1">Até 10MB (foto) ou 50MB (vídeo)</p>
            </label>
          ) : (
            <div className="relative rounded-2xl overflow-hidden bg-[#0F172A]">
              {isVideo ? (
                <video
                  src={preview ?? undefined}
                  className="w-full max-h-64 object-contain"
                  controls
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview ?? undefined}
                  alt="Preview"
                  className="w-full max-h-64 object-contain"
                />
              )}
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
              >
                <X size={14} />
              </button>
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1">
                {isVideo ? (
                  <Video size={12} className="text-white" />
                ) : (
                  <ImageIcon size={12} className="text-white" />
                )}
                <span className="text-white text-xs">{file.name}</span>
              </div>
            </div>
          )}

          {/* Caption */}
          <div>
            <label className="block text-[#94A3B8] text-xs font-semibold mb-2 uppercase tracking-wide">
              Legenda (opcional)
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Conta como foi a pelada... 🔥"
              rows={3}
              maxLength={280}
              className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] text-sm resize-none"
            />
            <p className="text-[#475569] text-xs text-right mt-1">
              {caption.length}/280
            </p>
          </div>

          {/* Match link (optional) */}
          {recentMatches.length > 0 && (
            <div>
              <label className="block text-[#94A3B8] text-xs font-semibold mb-2 uppercase tracking-wide">
                Vincular a uma partida (opcional)
              </label>
              <button
                onClick={() => setShowMatchPicker((v) => !v)}
                className="w-full flex items-center justify-between bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-sm min-h-[48px] hover:border-[#475569] transition-colors"
              >
                <span className={selectedMatch ? "text-[#F1F5F9]" : "text-[#475569]"}>
                  {selectedMatch ? selectedMatch.name : "Selecionar partida..."}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-[#64748B] transition-transform ${showMatchPicker ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {showMatchPicker && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-[#0F172A] border border-[#334155] border-t-0 rounded-b-xl mt-px overflow-hidden">
                      <button
                        onClick={() => {
                          setSelectedMatchId(null);
                          setShowMatchPicker(false);
                        }}
                        className="w-full px-4 py-3 text-left text-[#64748B] text-sm hover:bg-[#1E293B] transition-colors"
                      >
                        Nenhuma partida
                      </button>
                      {recentMatches.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedMatchId(m.id);
                            setShowMatchPicker(false);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 text-left text-[#F1F5F9] text-sm hover:bg-[#1E293B] transition-colors border-t border-[#334155]/50"
                        >
                          {m.name}
                          {selectedMatchId === m.id && (
                            <Check size={14} className="text-[#22C55E]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[#EF4444] text-sm"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>Enviando...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-[#0F172A] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-[#1D4ED8] rounded-full"
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={!file || uploading}
            onClick={handleUpload}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all min-h-[52px] ${
              !file || uploading
                ? "bg-[#1E293B] border border-[#334155] text-[#475569] cursor-not-allowed"
                : "bg-[#1D4ED8] text-white shadow-lg hover:bg-[#2563EB] active:scale-[0.98]"
            }`}
          >
            {uploading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Upload size={16} />
                Publicar
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

import { createClient } from "@/lib/supabase";
import { getActiveGroupId } from "./groupService";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaPost {
  id: string;
  group_id: string;
  author_id: string;
  author_name: string | null;
  match_id: string | null;
  storage_path: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string;
  url?: string; // signed/public URL (populated at query time)
}

export interface UploadMediaInput {
  file: File;
  caption?: string;
  matchId?: string | null;
}

// ─── Service Functions ────────────────────────────────────────────────────────

const BUCKET = "pelada-media";

/**
 * Upload a photo or video to Supabase Storage and create a media_posts record.
 */
export async function uploadMedia(
  input: UploadMediaInput,
  onProgress?: (pct: number) => void
): Promise<{ data: MediaPost | null; error: string | null }> {
  const supabase = createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { data: null, error: "Não autenticado. Faça login e tente novamente." };

  // 2. Check active group
  const groupId = getActiveGroupId();
  if (!groupId) return { data: null, error: "Você precisa estar em um grupo para postar. Selecione um grupo primeiro." };

  // 3. Verify user is still a member of that group
  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return {
      data: null,
      error: "Você não é membro deste grupo. Peça para entrar novamente.",
    };
  }

  const { file, caption, matchId } = input;

  // 4. Validate file
  const isVideo = file.type.startsWith("video/");
  const mediaType: "image" | "video" = isVideo ? "video" : "image";
  const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      data: null,
      error: isVideo
        ? "Vídeo muito grande. O limite é 50MB."
        : "Imagem muito grande. O limite é 10MB.",
    };
  }

  // Build storage path: {userId}/{timestamp}-{randomSuffix}.{ext}
  const ext = file.name.split(".").pop()?.toLowerCase() ?? (isVideo ? "mp4" : "jpg");
  const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  onProgress?.(10);

  // 5. Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("[mediaService] Storage upload error:", uploadError);
    if (uploadError.message.includes("Bucket not found")) {
      return { data: null, error: "Bucket de storage não encontrado. Execute o script SQL de configuração no Supabase." };
    }
    if (uploadError.message.includes("row-level security") || uploadError.message.includes("policy")) {
      return { data: null, error: "Sem permissão para fazer upload. Execute o script SQL de permissões no Supabase." };
    }
    return { data: null, error: `Erro ao enviar arquivo: ${uploadError.message}` };
  }

  onProgress?.(80);

  // 6. Get user display name
  const displayName = user.email?.split("@")[0] ?? "Usuário";

  // 7. Insert media_posts record
  const { data: post, error: postError } = await supabase
    .from("media_posts")
    .insert({
      group_id: groupId,
      author_id: user.id,
      author_name: displayName,
      match_id: matchId ?? null,
      storage_path: storagePath,
      media_type: mediaType,
      caption: caption?.trim() ?? null,
    })
    .select()
    .single();

  if (postError) {
    console.error("[mediaService] DB insert error:", postError);
    // Cleanup uploaded file on db error
    await supabase.storage.from(BUCKET).remove([storagePath]);
    if (postError.message.includes("row-level security") || postError.message.includes("policy")) {
      return { data: null, error: "Sem permissão para publicar. Execute o script SQL de permissões no Supabase." };
    }
    if (postError.message.includes("does not exist")) {
      return { data: null, error: "Tabela media_posts não existe. Execute o script SQL de configuração no Supabase." };
    }
    return { data: null, error: `Erro ao salvar publicação: ${postError.message}` };
  }

  onProgress?.(100);

  // 8. Get public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return {
    data: { ...(post as MediaPost), url: urlData.publicUrl },
    error: null,
  };
}

/**
 * Get the media feed for the current user's group (paginated).
 */
export async function getGroupMedia(params?: {
  limit?: number;
  before?: string; // ISO timestamp cursor for pagination
}): Promise<{
  data: MediaPost[];
  error: string | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Não autenticado." };

  const groupId = await getActiveGroupId();
  if (!groupId) return { data: [], error: null };

  const limit = params?.limit ?? 20;

  let query = supabase
    .from("media_posts")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params?.before) {
    query = query.lt("created_at", params.before);
  }

  const { data: posts, error } = await query;
  if (error) return { data: [], error: error.message };

  // Attach public URLs
  const result: MediaPost[] = (posts ?? []).map((p) => {
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(p.storage_path);
    return { ...(p as MediaPost), url: urlData.publicUrl };
  });

  return { data: result, error: null };
}

/**
 * Delete a media post and its associated file from storage.
 * Only the author can delete their own posts.
 */
export async function deleteMedia(
  postId: string,
  storagePath: string
): Promise<{ error: string | null }> {
  const supabase = createClient();

  // Delete DB record (RLS enforces author-only)
  const { error: dbError } = await supabase
    .from("media_posts")
    .delete()
    .eq("id", postId);

  if (dbError) return { error: dbError.message };

  // Delete from storage
  await supabase.storage.from(BUCKET).remove([storagePath]);

  return { error: null };
}

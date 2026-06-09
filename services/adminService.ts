import { createClient } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppAdmin {
  user_id: string;
  granted_by: string | null;
  added_at: string;
  email?: string;
}

export interface AdminGroup {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  is_password_protected: boolean;
  member_count: number;
  created_at: string;
  created_by: string;
}

export interface GroupMemberDetail {
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  email?: string;
  display_name?: string;
}

// ─── Admin check ──────────────────────────────────────────────────────────────

/**
 * Hardcoded list of super admin UUIDs.
 * These users are ALWAYS treated as admin regardless of the database state.
 * This guarantees admin access even if the app_admins table is empty or missing.
 */
const HARDCODED_SUPER_ADMINS: string[] = [
  "c73ee724-1ffe-45bf-93c8-5162387ba5ab", // melo97775@gmail.com
];

/**
 * Check if the current user is an app admin.
 * First checks the hardcoded list (always works), then falls back to the DB.
 */
export async function checkIsAdmin(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return false;

  // Hardcoded check — guaranteed to work regardless of DB state
  if (HARDCODED_SUPER_ADMINS.includes(user.id)) return true;

  // DB check — for dynamically added admins
  try {
    const { data } = await supabase
      .from("app_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Auto-register user as admin if their email is in NEXT_PUBLIC_SUPER_ADMIN_EMAILS.
 * Should be called on login.
 */
/**
 * @deprecated Admin registration is done directly via SQL in the Supabase database.
 * This function is intentionally disabled to prevent unauthorized self-promotion.
 * To add an admin, run the SQL migration: supabase/migrations/set_admin_and_lock_policies.sql
 */
export async function autoRegisterSuperAdmin(): Promise<void> {
  // Intentionally a no-op.
  // Admin access is granted manually via SQL in the Supabase dashboard.
  return;
}

// ─── Group CRUD (admin-only) ──────────────────────────────────────────────────

/**
 * Create a group (admin only). Password is stored as plain bcrypt-like hash via Supabase function,
 * but for simplicity we store it as plain text and compare client-side.
 * For production consider a Supabase Edge Function for proper hashing.
 */
export async function createGroup(params: {
  name: string;
  emoji?: string;
  description?: string;
  password?: string;
}): Promise<{ data: AdminGroup | null; error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autenticado." };

  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: params.name.trim(),
      emoji: params.emoji ?? "⚽",
      description: params.description?.trim() ?? null,
      created_by: user.id,
      is_password_protected: !!params.password,
      password_hash: params.password ? params.password : null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  // Add the creator as an admin member of the newly created group
  await supabase
    .from("group_members")
    .insert({
      group_id: data.id,
      user_id: user.id,
      role: "admin",
    });

  return { data: data as AdminGroup, error: null };
}

/**
 * Update an existing group.
 */
export async function updateGroup(
  groupId: string,
  params: {
    name?: string;
    emoji?: string;
    description?: string;
    password?: string | null;
  }
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const updates: Record<string, unknown> = {};
  if (params.name !== undefined) updates.name = params.name.trim();
  if (params.emoji !== undefined) updates.emoji = params.emoji;
  if (params.description !== undefined)
    updates.description = params.description?.trim() ?? null;
  if (params.password !== undefined) {
    updates.is_password_protected = !!params.password;
    updates.password_hash = params.password ?? null;
  }

  const { error } = await supabase
    .from("groups")
    .update(updates)
    .eq("id", groupId);

  return { error: error?.message ?? null };
}

/**
 * Delete a group.
 */
export async function deleteGroup(
  groupId: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  return { error: error?.message ?? null };
}

/**
 * Get all groups (admin view with member count).
 */
export async function getAllGroupsAdmin(): Promise<{
  data: AdminGroup[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as AdminGroup[], error: null };
}

/**
 * Get members of a group.
 */
export async function getGroupMembers(groupId: string): Promise<{
  data: GroupMemberDetail[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as GroupMemberDetail[], error: null };
}

/**
 * Remove a member from a group.
 */
export async function removeMember(
  groupId: string,
  userId: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  return { error: error?.message ?? null };
}

// ─── App Admins management ────────────────────────────────────────────────────

/**
 * Get all app admins.
 */
export async function getAllAdmins(): Promise<{
  data: AppAdmin[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("app_admins")
    .select("*")
    .order("added_at", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as AppAdmin[], error: null };
}

/**
 * Grant admin to a user by user_id.
 */
export async function grantAdmin(userId: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("app_admins")
    .insert({ user_id: userId, granted_by: user?.id ?? null });

  return { error: error?.message ?? null };
}

/**
 * Revoke admin from a user.
 */
export async function revokeAdmin(userId: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("app_admins")
    .delete()
    .eq("user_id", userId);
  return { error: error?.message ?? null };
}

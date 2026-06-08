import { createClient } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  invite_code: string;
  is_password_protected: boolean;
  member_count: number;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
}

export interface GroupWithMembers extends Group {
  members: (GroupMember & { display_name?: string | null })[];
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const ACTIVE_GROUP_KEY = "pelada_active_group_id";

export function getActiveGroupId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_GROUP_KEY);
}

export function setActiveGroupId(groupId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_GROUP_KEY, groupId);
}

export function clearActiveGroupId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_GROUP_KEY);
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Get all groups visible to any authenticated user (for the group selection screen).
 */
export async function getAllGroups(): Promise<{
  data: Group[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, emoji, description, invite_code, is_password_protected, member_count, created_by, created_at")
    .order("name", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Group[], error: null };
}

/**
 * Get all groups the current user has joined.
 */
export async function getMyGroups(): Promise<{
  data: Group[];
  error: string | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Não autenticado." };

  const { data: memberships, error: memberError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  if (memberError) return { data: [], error: memberError.message };
  if (!memberships?.length) return { data: [], error: null };

  const groupIds = memberships.map((m) => m.group_id);

  const { data, error } = await supabase
    .from("groups")
    .select("id, name, emoji, description, invite_code, is_password_protected, member_count, created_by, created_at")
    .in("id", groupIds)
    .order("name", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Group[], error: null };
}

/**
 * Get a single group by ID.
 */
export async function getGroupById(groupId: string): Promise<{
  data: Group | null;
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, emoji, description, invite_code, is_password_protected, member_count, created_by, created_at")
    .eq("id", groupId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as Group | null, error: null };
}

/**
 * Join a group without password.
 */
export async function joinGroupFree(groupId: string): Promise<{
  data: Group | null;
  error: string | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autenticado." };

  // Check if already a member
  const { data: existing } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: memberError } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: user.id, role: "member" });

    if (memberError) return { data: null, error: memberError.message };
  }

  return getGroupById(groupId);
}

/**
 * Join a group with password validation.
 */
export async function joinGroupWithPassword(
  groupId: string,
  password: string
): Promise<{ data: Group | null; error: string | null }> {
  const supabase = createClient();

  // Fetch group to check password
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, password_hash, is_password_protected")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) return { data: null, error: groupError.message };
  if (!group) return { data: null, error: "Grupo não encontrado." };

  if (group.is_password_protected && group.password_hash !== password) {
    return { data: null, error: "Senha incorreta." };
  }

  return joinGroupFree(groupId);
}

/**
 * Leave a group.
 */
export async function leaveGroup(
  groupId: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  return { error: error?.message ?? null };
}

/**
 * Check if the current user is a member of a given group.
 */
export async function isMemberOf(groupId: string): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  return !!data;
}

// ─── Legacy compat ────────────────────────────────────────────────────────────

/**
 * @deprecated Use getMyGroups + getActiveGroupId instead.
 * Kept for backwards compatibility with services that call getActiveGroupId from DB.
 */
export async function getMyGroup(): Promise<{
  data: Group | null;
  error: string | null;
}> {
  const activeId = getActiveGroupId();
  if (activeId) return getGroupById(activeId);

  const { data: groups } = await getMyGroups();
  if (groups.length > 0) {
    setActiveGroupId(groups[0].id);
    return { data: groups[0], error: null };
  }

  return { data: null, error: null };
}

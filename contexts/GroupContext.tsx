"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  Group,
  getMyGroups,
  getGroupById,
  joinGroupFree,
  joinGroupWithPassword,
  leaveGroup,
  getActiveGroupId,
  setActiveGroupId,
  clearActiveGroupId,
} from "@/services/groupService";
import { checkIsAdmin, autoRegisterSuperAdmin } from "@/services/adminService";

// ─── Context Type ─────────────────────────────────────────────────────────────

interface GroupContextValue {
  /** The currently active group (selected by user) */
  activeGroup: Group | null;
  /** Group ID shortcut */
  groupId: string | null;
  /** All groups this user has joined */
  myGroups: Group[];
  /** Whether the current user is an app admin */
  isAdmin: boolean;
  /** Whether the current user is an admin of the active group */
  isGroupAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  /** Refresh group data */
  refresh: () => Promise<void>;
  /** Switch the active group */
  switchGroup: (groupId: string) => Promise<void>;
  /** Join a group (free or with password) */
  handleJoinGroup: (
    groupId: string,
    password?: string
  ) => Promise<{ error: string | null }>;
  /** Leave a group */
  handleLeaveGroup: (groupId: string) => Promise<{ error: string | null }>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const GroupContext = createContext<GroupContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GroupProvider({ children }: { children: ReactNode }) {
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isGroupAdmin = activeGroup?.user_role === "admin";

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      // Auto-register super admin if applicable
      await autoRegisterSuperAdmin();

      // Parallel: fetch my groups + admin status
      const [{ data: groups, error: groupsErr }, adminStatus] =
        await Promise.all([getMyGroups(), checkIsAdmin()]);

      if (groupsErr) setError(groupsErr);
      else setError(null);

      setMyGroups(groups ?? []);
      setIsAdmin(adminStatus);

      // Resolve active group
      const savedId = getActiveGroupId();
      if (savedId) {
        const found = (groups ?? []).find((g) => g.id === savedId);
        if (found) {
          setActiveGroup(found);
        } else {
          // User is not a member of the saved group anymore (or never was)
          clearActiveGroupId();
          setActiveGroup((groups ?? [])[0] ?? null);
          if (groups?.[0]) setActiveGroupId(groups[0].id);
        }
      } else if (groups?.length) {
        setActiveGroup(groups[0]);
        setActiveGroupId(groups[0].id);
      } else {
        setActiveGroup(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const switchGroup = useCallback(
    async (groupId: string) => {
      const found = myGroups.find((g) => g.id === groupId);
      if (found) {
        setActiveGroup(found);
        setActiveGroupId(groupId);
        return;
      }
      // Might not be in myGroups yet — fetch
      const { data } = await getGroupById(groupId);
      if (data) {
        setActiveGroup(data);
        setActiveGroupId(groupId);
      }
    },
    [myGroups]
  );

  const handleJoinGroup = useCallback(
    async (
      groupId: string,
      password?: string
    ): Promise<{ error: string | null }> => {
      let result: { data: Group | null; error: string | null };
      if (password) {
        result = await joinGroupWithPassword(groupId, password);
      } else {
        result = await joinGroupFree(groupId);
      }

      if (!result.error && result.data) {
        setMyGroups((prev) => {
          if (prev.find((g) => g.id === result.data!.id)) return prev;
          return [...prev, result.data!];
        });
        setActiveGroup(result.data);
        setActiveGroupId(result.data.id);
      }

      return { error: result.error };
    },
    []
  );

  const handleLeaveGroup = useCallback(
    async (groupId: string): Promise<{ error: string | null }> => {
      const { error: err } = await leaveGroup(groupId);
      if (!err) {
        const updated = myGroups.filter((g) => g.id !== groupId);
        setMyGroups(updated);
        if (activeGroup?.id === groupId) {
          const next = updated[0] ?? null;
          setActiveGroup(next);
          if (next) setActiveGroupId(next.id);
          else clearActiveGroupId();
        }
      }
      return { error: err };
    },
    [myGroups, activeGroup]
  );

  return (
    <GroupContext.Provider
      value={{
        activeGroup,
        groupId: activeGroup?.id ?? null,
        myGroups,
        isAdmin,
        isGroupAdmin,
        isLoading,
        error,
        refresh,
        switchGroup,
        handleJoinGroup,
        handleLeaveGroup,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGroup(): GroupContextValue {
  const ctx = useContext(GroupContext);
  if (!ctx) {
    throw new Error("useGroup must be used inside <GroupProvider>");
  }
  return ctx;
}

-- ============================================================
-- Migração 006 — Permitir que Group Admins atualizem o grupo
-- ============================================================

DROP POLICY IF EXISTS "groups: admin update" ON groups;
CREATE POLICY "groups: admin update" ON groups
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM app_admins)
    OR auth.uid() = created_by
    OR id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid() AND role = 'admin')
  );

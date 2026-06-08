-- Garantir que apenas melo97775@gmail.com possa se tornar o primeiro admin (ou qualquer admin possa promover outros)
DROP POLICY IF EXISTS "app_admins: insert by admin" ON app_admins;

CREATE POLICY "app_admins: insert by admin" ON app_admins
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'email' = 'melo97775@gmail.com')
    OR auth.uid() IN (SELECT user_id FROM app_admins)
  );

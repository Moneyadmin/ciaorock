ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';
ALTER TABLE public.friendships ALTER COLUMN status SET DEFAULT 'pending';
GRANT UPDATE ON public.friendships TO authenticated;
DROP POLICY IF EXISTS friendships_insert_own ON public.friendships;
CREATE POLICY friendships_insert_own ON public.friendships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending' AND friend_id <> auth.uid());
CREATE POLICY friendships_accept_received ON public.friendships FOR UPDATE TO authenticated USING (friend_id = auth.uid()) WITH CHECK (friend_id = auth.uid() AND status = 'accepted');
DROP POLICY IF EXISTS friendships_delete_own ON public.friendships;
CREATE POLICY friendships_delete_own ON public.friendships FOR DELETE TO authenticated USING (user_id = auth.uid() OR friend_id = auth.uid());
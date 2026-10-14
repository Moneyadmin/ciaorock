import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRow } from "@/lib/api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Keep the daily login streak fresh (used by the "SERIE" badges). */
async function touchStreak(profile: ProfileRow & { last_login_date: string | null }) {
  const today = todayISO();
  if (profile.last_login_date === today) return profile;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const current = profile.last_login_date === yesterday ? profile.streak_current + 1 : 1;
  const best = Math.max(profile.streak_best, current);

  const { data } = await supabase
    .from("profiles")
    .update({ last_login_date: today, streak_current: current, streak_best: best })
    .eq("id", profile.id)
    .select("id,nickname,bio,streak_current,streak_best,last_login_date")
    .maybeSingle();

  return (data as (ProfileRow & { last_login_date: string | null }) | null) ?? profile;
}

export type SessionState = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  profile: ProfileRow | null;
  banned: boolean;
  admin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export function useSession(): SessionState {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [banned, setBanned] = useState(false);
  const [admin, setAdmin] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    setUserId(user?.id ?? null);
    setEmail(user?.email ?? null);

    if (!user) {
      setProfile(null);
      setBanned(false);
      setAdmin(false);
      setLoading(false);
      return;
    }

    const [{ data: row }, { data: roleRow }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,nickname,bio,streak_current,streak_best,last_login_date,banned")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    setAdmin(Boolean(roleRow));

    if (row) {
      setBanned(Boolean((row as { banned?: boolean }).banned));
      const fresh = await touchStreak(row as ProfileRow & { last_login_date: string | null });
      setProfile({
        id: fresh.id,
        nickname: fresh.nickname,
        bio: fresh.bio,
        streak_current: fresh.streak_current,
        streak_best: fresh.streak_best,
      });
    } else {
      setProfile(null);
      setBanned(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void load();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUserId(null);
    setAdmin(false);
    setBanned(false);
  }, []);

  return { loading, userId, email, profile, banned, admin, refresh: load, signOut };
}

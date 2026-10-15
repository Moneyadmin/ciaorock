import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRow } from "@/lib/api";

/** Keep the daily login streak fresh (used by the "SERIE" badges): computed by the database. */
async function touchStreak(profile: ProfileRow & { last_login_date: string | null }) {
  const { data, error } = await supabase.rpc("touch_streak");
  const row = data?.[0];
  if (error || !row) return profile;
  return { ...profile, ...row };
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
      // Nessun profilo: se l'account non esiste più sul server (es. cancellato o unito a un
      // altro durante la migrazione) la sessione salvata è inutile, quindi usciamo.
      const { error } = await supabase.auth.getUser();
      if (
        error &&
        (error.status === 401 ||
          error.status === 403 ||
          /not.*exist|not found/i.test(error.message))
      ) {
        await supabase.auth.signOut({ scope: "local" });
        setUserId(null);
        setEmail(null);
      }
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

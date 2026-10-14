import { showNotification } from "@/lib/notify";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchLatestAnnouncement, fetchProfileById } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const SEEN_KEY = "rockdex.announcement.seen";

function notify(title: string, body: string) {
  void showNotification(title, body);
}

/** Ascolta in tempo reale avvisi dello staff e nuovi messaggi privati. */
export function LiveAlerts() {
  const { userId } = useSession();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const show = (a: { id: string; title: string; body: string }) => {
      if (localStorage.getItem(SEEN_KEY) === a.id) return;
      localStorage.setItem(SEEN_KEY, a.id);
      toast(`📣 ${a.title}`, { description: a.body, duration: 10000 });
      notify(`📣 ${a.title}`, a.body);
    };

    void fetchLatestAnnouncement()
      .then((a) => {
        if (!cancelled && a) show(a);
      })
      .catch(() => {});

    const channel = supabase
      .channel(`alerts-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, (p) =>
        show(p.new as { id: string; title: string; body: string }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` },
        async (p) => {
          const msg = p.new as { sender_id: string; body: string };
          if (window.location.pathname === `/chat/${msg.sender_id}`) return;
          const sender = await fetchProfileById(msg.sender_id).catch(() => null);
          const title = `💬 ${sender ? "@" + sender.nickname : "Nuovo messaggio"}`;
          toast(title, { description: msg.body });
          notify(title, msg.body);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}

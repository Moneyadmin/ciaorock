import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fetchInbox, type InboxEntry } from "@/lib/api";
import { useSession } from "@/lib/useSession";

export const Route = createFileRoute("/messaggi")({
  head: () => ({
    meta: [
      { title: "Messaggi — RockDex" },
      { name: "description", content: "Le tue conversazioni private con gli altri cercatori." },
      { property: "og:title", content: "Messaggi — RockDex" },
      { property: "og:description", content: "Tutte le tue chat con gli altri cercatori di sassi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const { loading, userId } = useSession();
  const navigate = useNavigate();
  const [items, setItems] = useState<InboxEntry[] | null>(null);

  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/auth" });
  }, [loading, userId, navigate]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const reload = () =>
      fetchInbox(userId)
        .then((r) => alive && setItems(r))
        .catch(() => alive && setItems([]));
    void reload();
    const channel = supabase
      .channel(`inbox-${userId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void reload())
      .subscribe();
    const poll = window.setInterval(reload, 6000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <AppShell title="Messaggi" subtitle="Le tue conversazioni">
      <Link to="/amici" className="text-sm font-bold text-primary">
        ← Amici
      </Link>
      <div className="mt-3 space-y-2">
        {items === null && <p className="pebble-card p-4 text-sm text-muted-foreground">Carico…</p>}
        {items?.length === 0 && (
          <p className="pebble-card p-4 text-sm text-muted-foreground">
            Nessuna conversazione. Apri il profilo di un amico e tocca "Invia un messaggio 💬".
          </p>
        )}
        {items?.map(({ other, last }) => (
          <Link
            key={other.id}
            to="/chat/$id"
            params={{ id: other.id }}
            className="pebble-card block p-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">@{other.nickname}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(last.created_at).toLocaleString("it-IT", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {last.sender_id === userId ? "Tu: " : ""}
              {last.body}
            </p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

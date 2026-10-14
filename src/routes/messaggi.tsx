import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
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
      <Link
        to="/amici"
        className="press inline-flex items-center gap-1 rounded-full bg-muted py-1.5 pl-2 pr-3.5 text-sm font-extrabold text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={3} /> Amici
      </Link>
      <div className="mt-3 space-y-2">
        {items === null && (
          <p className="pebble-card flex items-center gap-2 p-4 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carico…
          </p>
        )}
        {items?.length === 0 && (
          <div className="pebble-card p-6 text-center">
            <span className="bg-brand mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white shadow-glow">
              <MessageCircle className="h-7 w-7" />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              Nessuna conversazione. Apri il profilo di un amico e tocca "Invia un messaggio".
            </p>
          </div>
        )}
        {items?.map(({ other, last }) => (
          <Link
            key={other.id}
            to="/chat/$id"
            params={{ id: other.id }}
            className="pebble-card press flex items-center gap-3 rounded-[1.3rem] p-2.5 pr-4"
          >
            <Avatar name={other.nickname} className="h-12 w-12 text-xl" />
            <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-extrabold">@{other.nickname}</span>
              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
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
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
